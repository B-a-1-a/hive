#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off globalTimers:off globalDate:off globalFetch:off globalConsole:off - Plain Node test tooling: it runs before any Effect runtime and inside sandboxes.
// A browser for agents that cannot start one (sandboxed Codex has no browser, localhost, or
// sockets). Run on the host: it starts an isolated app with sample projects, then plays JSON
// job files that agents drop into a folder. Agents submit with scripts/browser-job.ts.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";

import { type BrowserContext, chromium, type Locator, type Page } from "playwright-core";

import {
  brokenPage,
  CHECKOUT,
  type Control,
  MISSING_BROWSER_HELP,
  OFFLINE_BROWSER_ARGS,
  privacyWarnings,
  renderedTheme,
  type SampleThread,
  scrollShots,
  seedSampleProjects,
  settle,
  startIsolatedApp,
  visibleControls,
} from "./testing/app-capture.ts";
import { isPidAlive } from "./scenarios/home-guard.ts";
import { HEARTBEAT_MS, type Job, parseJob, serviceDir, type Step } from "./testing/browser-jobs.ts";

const ACTION_MS = 8_000;
const JOB_MS = 5 * 60_000;
const PARALLEL_AGENTS = 4;

const args = NodeUtil.parseArgs({
  options: { dir: { type: "string" }, app: { type: "string" } },
}).values;
const dir = serviceDir(args.dir);
const paths = {
  service: NodePath.join(dir, "service.json"),
  jobs: NodePath.join(dir, "jobs"),
  running: NodePath.join(dir, "running"),
  results: NodePath.join(dir, "results"),
  captures: NodePath.join(dir, "captures"),
};

const writeAtomic = (file: string, content: string) => {
  NodeFS.writeFileSync(`${file}.tmp`, content);
  NodeFS.renameSync(`${file}.tmp`, file);
};

// One service per folder. The lock is taken before anything starts, so two launches at once
// cannot both serve the queue; a lock whose owner is gone is taken over.
const lockFile = NodePath.join(dir, "service.lock");
NodeFS.mkdirSync(dir, { recursive: true });
const takeLock = () => {
  try {
    NodeFS.writeFileSync(lockFile, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    return false;
  }
};
if (!takeLock()) {
  const owner = Number(NodeFS.readFileSync(lockFile, "utf8"));
  if (isPidAlive(owner)) {
    console.error(
      `A browser service (pid ${owner}) already serves ${dir}. Agents may be using it: do not restart it.`,
    );
    process.exit(2);
  }
  NodeFS.rmSync(lockFile, { force: true });
  if (!takeLock()) {
    console.error(`Another browser service is starting for ${dir}.`);
    process.exit(2);
  }
}
process.on("exit", () => NodeFS.rmSync(lockFile, { force: true }));
for (const folder of [paths.jobs, paths.running, paths.results, paths.captures]) {
  NodeFS.mkdirSync(folder, { recursive: true });
}
// Jobs left from a stopped service would never finish; their agents get an answer instead.
for (const name of NodeFS.readdirSync(paths.running)) {
  writeAtomic(
    NodePath.join(paths.results, name),
    JSON.stringify({ ok: false, stopped: true, log: [] }),
  );
  NodeFS.rmSync(NodePath.join(paths.running, name), { force: true });
}

// The app's home lives outside the repository; agents never see or need it.
const runDir = args.app ?? NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "hive-browser-"));
console.log(`browser service: jobs in ${paths.jobs}\napp state: ${runDir}`);
const app = await startIsolatedApp(runDir);
const threads = await seedSampleProjects(app);
const browser = await chromium.launch({ args: OFFLINE_BROWSER_ARGS }).catch((error: Error) => {
  console.error(`Chromium did not start: ${error.message.split("\n")[0]}\n${MISSING_BROWSER_HELP}`);
  app.stop();
  process.exit(3);
});
const signIn = await browser.newContext();
const signInPage = await signIn.newPage();
await signInPage.goto(`${app.origin}${app.pairingPath}`);
await signInPage.waitForURL((url) => !url.pathname.startsWith("/pair"), { timeout: 60_000 });
const signedIn = await signIn.storageState();
await signIn.close();

const startedAt = Date.now();
const heartbeat = () =>
  writeAtomic(
    paths.service,
    `${JSON.stringify(
      {
        pid: process.pid,
        startedAt,
        heartbeatAt: Date.now(),
        checkout: CHECKOUT,
        origin: app.origin,
        home: app.home,
        threads: Object.keys(threads).map((key) => `thread:${key}`),
      },
      null,
      2,
    )}\n`,
  );
heartbeat();
const heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);

let stopping = false;
const shutdown = async (code: number) => {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeatTimer);
  NodeFS.rmSync(paths.service, { force: true });
  await browser.close().catch(() => {});
  app.stop();
  // The app's state is disposable; captures live in the service folder.
  if (args.app === undefined) {
    await Promise.race([
      app.exited.catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 10_000)),
    ]);
    NodeFS.rmSync(runDir, { recursive: true, force: true });
  }
  process.exit(code);
};
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => void shutdown(0));
}
app.exited.catch((error: Error) => {
  console.error(error.message);
  void shutdown(1);
});

const jobPages = new Map<string, Page>();

/** One browser context per agent: warm module cache, but no storage shared between agents. */
const contexts = new Map<string, BrowserContext>();
async function contextFor(job: Job): Promise<BrowserContext> {
  const key = `${job.agent}|${job.viewport.width}x${job.viewport.height}|${job.colorScheme}`;
  let context = contexts.get(key);
  if (context === undefined) {
    context = await browser.newContext({
      viewport: job.viewport,
      colorScheme: job.colorScheme,
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
      storageState: signedIn,
    });
    context.on("page", (page) => {
      page.on("dialog", (dialog) => void dialog.dismiss().catch(() => {}));
    });
    contexts.set(key, context);
  }
  for (const stale of context.pages()) await stale.close().catch(() => {});
  return context;
}

const describe = (control: Control) =>
  `${control.role}: ${control.name}${control.disabled ? " (disabled)" : ""} @${control.box[0]},${control.box[1]} ${control.box[2]}x${control.box[3]}`;

function locate(page: Page, step: Step): Locator | undefined {
  const root = step.within === undefined ? page : page.locator(step.within).first();
  const exact = step.exact === true;
  const found =
    step.role !== undefined
      ? root.getByRole(
          step.role as Parameters<Page["getByRole"]>[0],
          step.name === undefined ? {} : { name: step.name, exact },
        )
      : step.text !== undefined
        ? root.getByText(step.text, { exact })
        : step.label !== undefined
          ? root.getByLabel(step.label, { exact })
          : step.placeholder !== undefined
            ? root.getByPlaceholder(step.placeholder, { exact })
            : step.css !== undefined
              ? root.locator(step.css)
              : undefined;
  if (found === undefined) return undefined;
  return found.filter({ visible: true }).nth(step.nth ?? 0);
}

async function play(job: Job, name: string): Promise<{ ok: boolean; log: Array<string> }> {
  const log: Array<string> = [];
  const context = await contextFor(job);
  const page = await context.newPage();
  jobPages.set(name, page);
  page.setDefaultTimeout(ACTION_MS);
  const pageErrors: Array<string> = [];
  page.on("pageerror", (error) => pageErrors.push(error.message.split("\n")[0] ?? ""));
  const outDir = NodePath.join(paths.captures, job.agent);
  NodeFS.mkdirSync(outDir, { recursive: true });
  const manifest = NodePath.join(outDir, "manifest.jsonl");
  const dump = async (limit = 80) => {
    const controls = await page.evaluate(visibleControls);
    log.push(`  route ${new URL(page.url()).pathname}, ${controls.length} controls:`);
    for (const control of controls.slice(0, limit)) log.push(`    ${describe(control)}`);
    return controls;
  };
  try {
    // A fresh layout per job: open panels and drafts from an earlier job must not leak in.
    await page.goto(`${app.origin}/`);
    const session = await context.newCDPSession(page);
    await session.send("Storage.clearDataForOrigin", {
      origin: app.origin,
      storageTypes: "local_storage,session_storage,indexeddb",
    });
    await session.detach();
    for (const [index, step] of job.steps.entries()) {
      const tag = `step ${index + 1} ${step.do}`;
      try {
        switch (step.do) {
          case "goto": {
            const target = step.path?.startsWith("thread:")
              ? threads[step.path.slice("thread:".length) as SampleThread]
              : step.path;
            if (target === undefined) throw new Error(`Unknown path ${step.path}.`);
            await page.goto(`${app.origin}${target}`);
            await settle(page);
            break;
          }
          case "click":
          case "hover": {
            const target = locate(page, step);
            if (target === undefined) {
              if (step.x === undefined || step.y === undefined)
                throw new Error("Give a locator or x and y.");
              if (step.do === "hover") await page.mouse.move(step.x, step.y);
              else
                await page.mouse.click(step.x, step.y, {
                  button: step.button ?? "left",
                  clickCount: step.double ? 2 : 1,
                });
            } else if (step.do === "hover") {
              await target.hover();
            } else {
              await target.click({
                button: step.button ?? "left",
                clickCount: step.double ? 2 : 1,
              });
            }
            await settle(page);
            break;
          }
          case "fill": {
            const target = locate(page, step);
            if (target === undefined) throw new Error("fill needs a locator.");
            await target.fill(step.value ?? "");
            break;
          }
          case "type":
            await page.keyboard.type(step.value ?? "");
            break;
          case "press":
            await page.keyboard.press(step.key ?? "");
            await settle(page);
            break;
          case "wheel":
            if (step.x !== undefined && step.y !== undefined) await page.mouse.move(step.x, step.y);
            await page.mouse.wheel(0, step.dy ?? 600);
            await settle(page);
            break;
          case "waitFor": {
            const target = locate(page, step);
            if (target === undefined) throw new Error("waitFor needs a locator.");
            await target.waitFor({ state: step.gone ? "hidden" : "visible" });
            break;
          }
          case "dump":
            await dump();
            if (step.withText) log.push((await page.locator("body").innerText()).slice(0, 4000));
            break;
          case "shot": {
            const id = step.id ?? "";
            const broken = await brokenPage(page);
            if (broken !== undefined) throw new Error(`${broken}; not saved as ${id}.`);
            if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
            const files = await scrollShots(page, NodePath.join(outDir, id), step.scroll ? 15 : 1);
            const controls = await page.evaluate(visibleControls);
            const privacy = await privacyWarnings(page);
            const row = {
              id,
              title: step.title ?? id,
              how: step.how ?? "",
              notes: step.notes ?? "",
              route: new URL(page.url()).pathname,
              files: files.map((file) => NodePath.relative(dir, file)),
              viewport: `${job.viewport.width}x${job.viewport.height}`,
              theme: await renderedTheme(page),
              controls,
              ...(privacy.length > 0 ? { privacy } : {}),
            };
            NodeFS.appendFileSync(manifest, `${JSON.stringify(row)}\n`);
            log.push(
              `${tag}: saved ${row.files.join(", ")} at ${row.route}${privacy.length > 0 ? `; PRIVACY: ${privacy.join("; ")}` : ""}`,
            );
            if (step.list !== false)
              for (const control of controls.slice(0, 50)) log.push(`    ${describe(control)}`);
            continue;
          }
        }
        log.push(`${tag}: ok`);
      } catch (error) {
        const message = (error as Error).message.split("\n")[0] ?? "";
        if (step.optional) {
          log.push(`${tag}: skipped (${message})`);
          continue;
        }
        log.push(`${tag}: FAILED ${message}`);
        await page.screenshot({ path: NodePath.join(outDir, "_last-error.png") }).catch(() => {});
        await dump(60).catch(() => {});
        return { ok: false, log };
      }
    }
    return { ok: true, log };
  } finally {
    jobPages.delete(name);
    await page.close().catch(() => {});
    log.unshift(`job ${name} (${job.agent})`);
  }
}

const busyAgents = new Set<string>();
const scan = () => {
  if (stopping) return;
  for (const name of NodeFS.readdirSync(paths.jobs)
    .filter((file) => file.endsWith(".json"))
    .sort()) {
    if (busyAgents.size >= PARALLEL_AGENTS) return;
    let job: Job;
    try {
      job = parseJob(NodeFS.readFileSync(NodePath.join(paths.jobs, name), "utf8"));
    } catch (error) {
      writeAtomic(
        NodePath.join(paths.results, name),
        JSON.stringify({ ok: false, log: [`Invalid job: ${(error as Error).message}`] }),
      );
      NodeFS.rmSync(NodePath.join(paths.jobs, name), { force: true });
      continue;
    }
    // One job at a time per agent, so an agent's jobs never close each other's pages.
    if (busyAgents.has(job.agent)) continue;
    busyAgents.add(job.agent);
    NodeFS.renameSync(NodePath.join(paths.jobs, name), NodePath.join(paths.running, name));
    const running = play(job, name).catch((error: Error) => ({
      ok: false,
      log: [`Job ${name} crashed: ${error.message}`],
    }));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), JOB_MS);
    });
    void Promise.race([running, timeout])
      .then(async (outcome) => {
        clearTimeout(timer);
        if (outcome !== "timeout") return outcome;
        // Closing the job's page ends its steps, so it cannot write after its result.
        await jobPages
          .get(name)
          ?.close()
          .catch(() => {});
        await running;
        return { ok: false, log: [`Job ${name} took over ${JOB_MS / 60_000} min.`] };
      })
      .then((played) => {
        const result = stopping ? { ok: false, stopped: true, log: played.log } : played;
        writeAtomic(NodePath.join(paths.results, name), JSON.stringify(result));
        NodeFS.rmSync(NodePath.join(paths.running, name), { force: true });
        busyAgents.delete(job.agent);
        console.log(`${result.ok ? "done  " : "failed"} ${name}`);
        scan();
      });
  }
};
NodeFS.watch(paths.jobs, () => scan());
setInterval(scan, 1_000);
console.log("ready: agents can submit jobs now");
