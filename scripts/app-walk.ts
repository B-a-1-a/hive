#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off globalTimers:off globalDate:off globalFetch:off globalConsole:off - Plain Node test tooling: it runs before any Effect runtime and inside sandboxes.
// Walks the web app with no agent: an isolated dev app on the replay agent, sample projects, every
// route and the main menus, then screenshots and manifest.json. See the test-t3-app skill.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";

import { chromium, type Locator, type Page } from "playwright-core";

import {
  brokenPage,
  type Control,
  MISSING_BROWSER_HELP,
  OFFLINE_BROWSER_ARGS,
  PLATFORM,
  privacyWarnings,
  type SampleThread,
  scrollShots,
  seedSampleProjects,
  settle,
  startIsolatedApp,
  visibleControls,
} from "./testing/app-capture.ts";

const VIEWPORT = { width: 1440, height: 900 };
const STEP_MS = 15_000;

interface Stop {
  readonly id: string;
  readonly title: string;
  /** The clicks or keys a person uses to get there. */
  readonly how: string;
  readonly path: string | SampleThread;
  /** Where the app must end up; defaults to `path`, `*` accepts anywhere. */
  readonly expect?: string;
  /** Set for a route behind a flag: landing elsewhere is a skip, not an error. */
  readonly gate?: string;
  /** Opens a menu or panel after the page settles; `ready` must then be visible. */
  readonly open?: (page: Page) => Promise<void>;
  readonly ready?: (page: Page) => Locator;
}

const SETTINGS: ReadonlyArray<readonly [string, string]> = [
  ["general", "General"],
  ["appearance", "Appearance"],
  ["chat", "Chat"],
  ["diffs", "Diffs & pull requests"],
  ["keybindings", "Keybindings"],
  ["voice", "Voice"],
  ["snap-shot", "SnapShots"],
  ["providers", "Providers"],
  ["threads", "Threads"],
  ["browser", "Browser"],
  ["devices", "Devices"],
  ["scheduled-tasks", "Scheduled tasks"],
  ["projects", "Projects"],
  ["source-control", "Source control"],
  ["worktrees", "Worktrees"],
  ["connections", "Environments"],
  ["access", "Sharing & access"],
  ["maintenance", "Maintenance"],
  ["labs", "Labs"],
  ["about", "About"],
  ["archived", "Archive"],
  ["diagnostics", "Diagnostics"],
];

const dialog = (page: Page) => page.getByRole("dialog").last();

const STOPS: ReadonlyArray<Stop> = [
  { id: "home", title: "Home", how: "Open the app", path: "/", expect: "*" },
  { id: "welcome", title: "Welcome", how: "Settings > About > Welcome page", path: "/welcome" },
  {
    id: "thread-git",
    title: "Finished thread in a git project",
    how: "Sidebar > Add monthly totals",
    path: "git",
  },
  {
    id: "thread-plain",
    title: "Thread in a plain folder",
    how: "Sidebar > Plan the week",
    path: "plain",
  },
  {
    id: "thread-question",
    title: "Thread waiting on a question",
    how: "Sidebar > Pick a cover letter tone",
    path: "question",
  },
  {
    id: "thread-approval",
    title: "Thread waiting on an approval",
    how: "Sidebar > Write the config file",
    path: "approval",
  },
  {
    id: "command-palette",
    title: "Command palette",
    how: "Cmd/Ctrl+K",
    path: "git",
    open: (page) => page.keyboard.press(PLATFORM === "darwin" ? "Meta+k" : "Control+k"),
  },
  {
    id: "add-project",
    title: "Add project dialog",
    how: "Sidebar > Add project",
    path: "git",
    open: (page) => page.getByRole("button", { name: "Add project" }).first().click(),
  },
  {
    id: "model-picker",
    title: "Model picker",
    how: "Composer > model chip",
    path: "git",
    open: (page) =>
      page
        .getByRole("button", { name: /Showcase|Multi turn/ })
        .first()
        .click(),
    ready: (page) => page.getByPlaceholder("Search models"),
  },
  {
    id: "thread-menu",
    title: "Thread context menu",
    how: "Sidebar > right-click a thread",
    path: "git",
    open: (page) =>
      page.getByRole("button", { name: /^Add monthly totals,/ }).click({ button: "right" }),
    // The web build draws its own menu; desktop shows a native one that CDP cannot capture.
    ready: (page) => page.locator('[data-context-menu="true"]').last(),
  },
  { id: "usage", title: "Usage", how: "Sidebar > Usage", path: "/usage" },
  {
    id: "pull-requests",
    title: "Pull requests",
    how: "Sidebar > Pull requests",
    path: "/pull-requests",
  },
  { id: "guest", title: "Join a shared thread", how: "Open a guest link", path: "/guest" },
  ...SETTINGS.map(([slug, label]) => ({
    id: `settings-${slug}`,
    title: `Settings: ${label}`,
    how: `Settings > ${label}`,
    path: `/settings/${slug}`,
  })),
  {
    id: "settings-secrets",
    title: "Settings: Secrets",
    how: "Settings > Secrets",
    path: "/settings/secrets",
    gate: "needs T3CODE_FEATURE_SECRETS",
  },
];

interface Row {
  readonly id: string;
  readonly title: string;
  readonly how: string;
  readonly route: string;
  readonly status: "ok" | "error" | "skipped";
  readonly reason?: string;
  readonly files: ReadonlyArray<string>;
  readonly viewport: string;
  readonly theme: string;
  readonly controls: ReadonlyArray<Control>;
  readonly privacy?: ReadonlyArray<string>;
}

const args = NodeUtil.parseArgs({
  options: {
    out: { type: "string" },
    theme: { type: "string", default: "light" },
    only: { type: "string" },
    keep: { type: "boolean", default: false },
  },
}).values;
const theme = args.theme === "dark" ? "dark" : "light";
const runDir = NodePath.resolve(
  args.out ?? NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "hive-walk-")),
);
const captures = NodePath.join(runDir, "captures");
NodeFS.rmSync(captures, { recursive: true, force: true });
NodeFS.mkdirSync(captures, { recursive: true });
console.log(`walk: ${runDir}`);

const app = await startIsolatedApp(runDir).catch((error: Error) => {
  console.error(error.message);
  process.exit(2);
});
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => {
    app.stop();
    process.exit(130);
  });
}
console.log(`app:  ${app.origin}\nseeding sample projects and replay threads`);
const threads = await seedSampleProjects(app);

const browser = await chromium.launch({ args: OFFLINE_BROWSER_ARGS }).catch((error: Error) => {
  console.error(`Chromium did not start: ${error.message.split("\n")[0]}\n${MISSING_BROWSER_HELP}`);
  app.stop();
  process.exit(3);
});
const context = await browser.newContext({
  viewport: VIEWPORT,
  colorScheme: theme,
  reducedMotion: "reduce",
  deviceScaleFactor: 1,
});
const signIn = await context.newPage();
await signIn.goto(`${app.origin}${app.pairingPath}`);
await signIn.waitForURL((url) => !url.pathname.startsWith("/pair"), { timeout: 60_000 });
await signIn.close();

const rows: Array<Row> = [];
const only = args.only?.split(",");
for (const stop of STOPS) {
  if (only && !only.includes(stop.id)) continue;
  const path = stop.path.startsWith("/") ? stop.path : threads[stop.path as SampleThread];
  const expected = stop.expect ?? path;
  const page = await context.newPage();
  const pageErrors: Array<string> = [];
  page.on("pageerror", (error) => pageErrors.push(error.message.split("\n")[0] ?? ""));
  page.on("dialog", (nativeDialog) => void nativeDialog.dismiss().catch(() => {}));
  const base = {
    id: stop.id,
    title: stop.title,
    how: stop.how,
    viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
    theme,
  };
  let row: Row;
  try {
    await page.goto(`${app.origin}${path}`, { timeout: STEP_MS * 2 });
    await settle(page);
    if (stop.open) {
      await stop.open(page);
      await (stop.ready ?? dialog)(page).waitFor({ state: "visible", timeout: STEP_MS });
      await settle(page);
    }
    const route = new URL(page.url()).pathname;
    if (expected !== "*" && route !== expected) {
      if (stop.gate === undefined) throw new Error(`Asked for ${expected}, landed on ${route}.`);
      row = {
        ...base,
        route,
        status: "skipped",
        reason: `Redirected to ${route}: ${stop.gate}.`,
        files: [],
        controls: [],
      };
    } else {
      const broken = await brokenPage(page);
      if (broken !== undefined) throw new Error(broken);
      if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
      const controls = await page.evaluate(visibleControls);
      const privacy = await privacyWarnings(page);
      const files = await scrollShots(page, NodePath.join(captures, stop.id));
      row = {
        ...base,
        route,
        status: "ok",
        files: files.map((file) => NodePath.relative(runDir, file)),
        controls,
        ...(privacy.length > 0 ? { privacy } : {}),
      };
    }
  } catch (error) {
    // Kept as evidence beside the captures, never counted as one.
    const file = NodePath.join(captures, `${stop.id}.error.png`);
    await page.screenshot({ path: file }).catch(() => {});
    row = {
      ...base,
      route: new URL(page.url()).pathname,
      status: "error",
      reason: (error as Error).message.split("\n")[0] ?? "",
      files: NodeFS.existsSync(file) ? [NodePath.relative(runDir, file)] : [],
      controls: [],
    };
  }
  rows.push(row);
  const detail =
    row.reason ??
    `${row.files.length} shot(s)${row.privacy ? `, PRIVACY: ${row.privacy.join("; ")}` : ""}`;
  console.log(`${row.status.padEnd(7)} ${row.id}: ${detail}`);
  await page.close();
}

await browser.close();
NodeFS.writeFileSync(
  NodePath.join(runDir, "manifest.json"),
  `${JSON.stringify({ surface: "web", theme, captures: rows }, null, 2)}\n`,
);
const errors = rows.filter((row) => row.status === "error").length;
const leaks = rows.filter((row) => row.privacy).length;
console.log(
  `\n${rows.filter((row) => row.status === "ok").length} captured, ${errors} errors, ${leaks} with private text. ${NodePath.join(runDir, "manifest.json")}`,
);
if (args.keep) {
  console.log(`--keep: the app stays up at ${app.origin} until you stop this command.`);
  await app.exited.catch(() => {});
}
app.stop();
process.exit(errors > 0 ? 1 : 0);
