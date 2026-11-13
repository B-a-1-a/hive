// @effect-diagnostics nodeBuiltinImport:off globalTimers:off globalDate:off globalFetch:off globalConsole:off - Plain Node test tooling: it runs before any Effect runtime and inside sandboxes.
/// <reference lib="dom" />
// Shared by the app walk and the browser service: an isolated dev app on the replay agent with
// sample projects, and the page checks that keep a broken screen out of the captures.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeNet from "node:net";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import type { Page } from "playwright-core";

const SCRIPTS = NodePath.dirname(import.meta.dirname);
// oxlint-disable-next-line t3code/no-global-process-runtime -- Plain Node tooling with no Effect runtime.
export const PLATFORM = NodeOS.platform();
export const CHECKOUT = NodePath.dirname(SCRIPTS);
export const LOOPBACK = "127.0.0.1";
const STARTUP_MS = 300_000;
const SETTLE_MS = 15_000;

/** Chromium resolves only loopback names, so nothing a page links to can leave the machine. */
export const OFFLINE_BROWSER_ARGS = [
  "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost",
];
export const MISSING_BROWSER_HELP =
  "If Chromium is missing, run: node scripts/node_modules/playwright-core/cli.js install --only-shell chromium. If this process is sandboxed, it cannot start a browser: use scripts/browser-service.ts from a host shell.";

/** Text the app shows instead of a page: a capture with one of these is an error, not coverage. */
const BROKEN_PAGE_TEXT = [
  "Something went wrong.",
  "Hive failed to",
  "is not available for the selected target",
  "to change its settings.",
  "Couldn’t start a new thread",
  "Failed to fetch dynamically imported module",
];

export interface Control {
  readonly role: string;
  readonly name: string;
  readonly box: readonly [number, number, number, number];
  readonly disabled?: true;
}

/** Interactive elements on screen with their boxes. Runs in the page. */
export const visibleControls = (): Array<Control> => {
  const selector =
    'button, a[href], input, textarea, select, [role="button"], [role="menuitem"], [role="tab"], [role="switch"], [role="checkbox"], [role="combobox"], [role="option"], [role="link"]';
  const out: Array<Control> = [];
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    const rect = element.getBoundingClientRect();
    // Screen-reader-only copies are 1px wide and cannot be clicked.
    if (rect.width < 6 || rect.height < 6) continue;
    if (rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight || rect.left > innerWidth)
      continue;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.opacity === "0") continue;
    const name = (
      element.getAttribute("aria-label") ??
      element.getAttribute("title") ??
      element.innerText ??
      element.getAttribute("placeholder") ??
      ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80);
    const disabled =
      element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
    out.push({
      role: element.getAttribute("role") ?? element.tagName.toLowerCase(),
      name,
      box: [
        Math.round(rect.x),
        Math.round(rect.y),
        Math.round(rect.width),
        Math.round(rect.height),
      ],
      ...(disabled ? { disabled: true as const } : {}),
    });
  }
  return out;
};

/** Waits for lazy modules, fonts, and running animations, so a capture shows the settled page. */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await page.waitForLoadState("networkidle", { timeout: SETTLE_MS }).catch(() => {});
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page
    .waitForFunction(
      () => document.getAnimations().every((animation) => animation.playState !== "running"),
      null,
      { timeout: SETTLE_MS },
    )
    .catch(() => {});
}

/** The reason this page is not a real screen, or undefined when it is. */
export async function brokenPage(page: Page): Promise<string | undefined> {
  if ((await page.locator("vite-error-overlay").count()) > 0) return "Vite error overlay";
  const text = await page.locator("body").innerText();
  const marker = BROKEN_PAGE_TEXT.find((candidate) => text.includes(candidate));
  return marker === undefined ? undefined : `The page shows "${marker}"`;
}

/** Strings that would identify this machine or user in a capture. */
export const privateStrings = () =>
  [
    NodeOS.hostname(),
    NodeOS.hostname().replace(/\.local$/, ""),
    NodeOS.userInfo().username,
    NodeOS.homedir(),
  ].filter((value) => value.length >= 3);

export async function privacyWarnings(page: Page): Promise<Array<string>> {
  const text = await page.locator("body").innerText();
  return privateStrings()
    .filter((value) => text.includes(value))
    .map((value) => `page text contains "${value}"`);
}

/**
 * Screenshots the viewport, then scrolls the largest scrollable area a screen at a time until
 * it stops moving, so long pages are covered and short ones are not shot twice.
 */
export async function scrollShots(page: Page, base: string, limit = 8): Promise<Array<string>> {
  const files: Array<string> = [];
  for (let index = 1; index <= limit; index++) {
    const file = index === 1 ? `${base}.png` : `${base}-${index}.png`;
    await page.screenshot({ path: file });
    if (!NodeFS.existsSync(file)) throw new Error(`Screenshot ${file} was not written.`);
    files.push(file);
    const moved = await page.evaluate(() => {
      let largest: Element | undefined;
      let largestArea = 0;
      for (const element of document.querySelectorAll("*")) {
        if (!/(auto|scroll)/.test(getComputedStyle(element).overflowY)) continue;
        if (element.scrollHeight - element.clientHeight < 40) continue;
        const area = element.clientWidth * element.clientHeight;
        if (area > largestArea) [largest, largestArea] = [element, area];
      }
      if (!largest) return false;
      const before = largest.scrollTop;
      largest.scrollTop += largest.clientHeight * 0.9;
      return largest.scrollTop > before + 1;
    });
    if (!moved) break;
    await settle(page);
  }
  return files;
}

/** True when `dir` or a parent holds a .git entry. */
export function insideGitRepository(dir: string): boolean {
  for (let current = NodePath.resolve(dir); ; current = NodePath.dirname(current)) {
    if (NodeFS.existsSync(NodePath.join(current, ".git"))) return true;
    if (NodePath.dirname(current) === current) return false;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = NodeNet.createServer();
    server.once("error", reject);
    server.listen(0, LOOPBACK, () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
  });
}

async function poll<T>(what: string, probe: () => Promise<T | undefined>): Promise<T> {
  const deadline = Date.now() + STARTUP_MS;
  for (;;) {
    const value = await probe().catch(() => undefined);
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}.`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export interface IsolatedApp {
  readonly origin: string;
  readonly home: string;
  /** Path plus hash of the reusable sign-in link: a credential, never print or capture it. */
  readonly pairingPath: string;
  readonly environmentId: string;
  /** Rejects when the app stops. */
  readonly exited: Promise<never>;
  readonly stop: () => void;
}

/**
 * Starts the dev app through scenarios/start-app.ts on a fresh home in `runDir`: replay as the
 * default model, every real provider off, Codex replaced by a command that fails, and no project
 * made from the working directory. It runs in its own process group, which `stop` ends.
 */
export async function startIsolatedApp(runDir: string): Promise<IsolatedApp> {
  // A home inside a repository turns off threads without a project, and fixtures would nest in it.
  if (insideGitRepository(runDir)) {
    throw new Error(`${runDir} is inside a git repository. Pick a folder outside any repository.`);
  }
  NodeFS.mkdirSync(runDir, { recursive: true });
  const home = NodePath.join(runDir, "home");
  const port = await freePort();
  const origin = `http://${LOOPBACK}:${port}`;
  const log = NodeFS.openSync(NodePath.join(runDir, "app.log"), "w");
  const child = NodeChildProcess.spawn(
    process.execPath,
    [NodePath.join(SCRIPTS, "scenarios/start-app.ts"), "web", home, LOOPBACK, String(port)],
    {
      cwd: CHECKOUT,
      detached: PLATFORM !== "win32",
      stdio: ["ignore", log, log],
      env: { ...process.env, T3_SCENARIO_RUNTIME_MODE: "approval-required" },
    },
  );
  const stop = () => {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(PLATFORM === "win32" ? child.pid : -child.pid, "SIGTERM");
    } catch {}
  };
  process.on("exit", stop);
  const exited = new Promise<never>((_, reject) =>
    child.once("exit", (code) =>
      reject(new Error(`The app stopped (exit ${code}). See ${NodePath.join(runDir, "app.log")}.`)),
    ),
  );
  exited.catch(() => {});
  const ready = <T>(what: string, probe: () => Promise<T | undefined>) =>
    Promise.race([poll(what, probe), exited]);
  try {
    const descriptor = await ready("the app to answer", async () => {
      const response = await fetch(`${origin}/.well-known/t3/environment`);
      return response.ok ? ((await response.json()) as { environmentId?: string }) : undefined;
    });
    const pairingPath = await ready("the sign-in link", async () =>
      NodeFS.readFileSync(NodePath.join(home, "pairing-path"), "utf8"),
    );
    if (descriptor.environmentId === undefined) throw new Error("The app named no environment.");
    return { origin, home, pairingPath, environmentId: descriptor.environmentId, exited, stop };
  } catch (error) {
    stop();
    throw error;
  }
}

export type SampleThread = "git" | "plain" | "question" | "approval";

/**
 * Two projects: a plain folder ("Job Applications") and a git repository with an uncommitted
 * change ("Receipt Tracker"), with replayed threads, one waiting on a question and one on an
 * approval. Returns each thread's route.
 */
export async function seedSampleProjects(app: IsolatedApp): Promise<Record<SampleThread, string>> {
  // Loaded here: it pulls in the e2e runner, which nothing else in this file needs.
  const { makeState } = await import("../scenarios/t3.ts");
  const { state } = makeState(app.home);
  const plain = await state.project(
    "Job Applications",
    { "notes.md": "# Openings\n\n- Product designer\n- Support lead\n" },
    { git: false },
  );
  const git = await state.project("Receipt Tracker", {
    "src/totals.ts": "export const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);\n",
  });
  NodeFS.appendFileSync(NodePath.join(git, "src/totals.ts"), "// monthly totals next\n");
  const ids = {
    git: await state.thread({
      project: git,
      title: "Add monthly totals",
      messages: ["Add monthly totals", "Now the yearly ones"],
    }),
    plain: await state.thread({
      project: plain,
      title: "Plan the week",
      messages: ["Plan the week"],
      model: "todo-list",
    }),
    question: await state.thread({
      project: plain,
      title: "Pick a cover letter tone",
      messages: ["Draft a cover letter"],
      model: "question",
    }),
    approval: await state.thread({
      project: git,
      title: "Write the config file",
      messages: ["Write the config file"],
      model: "approval",
    }),
  };
  const route = (id: string) => `/${app.environmentId}/${id}`;
  return {
    git: route(ids.git),
    plain: route(ids.plain),
    question: route(ids.question),
    approval: route(ids.approval),
  };
}
