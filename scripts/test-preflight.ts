#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off globalTimers:off globalDate:off globalFetch:off globalConsole:off - Plain Node test tooling: it runs before any Effect runtime and inside sandboxes.
// Run before testing the app. Prints one JSON object on stdout and a plain summary on stderr.
// A failed check that the run needs exits 1: stop and offer the user the listed alternatives.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";

import { HEARTBEAT_MS, serviceDir } from "./testing/browser-jobs.ts";

// Xcode 26.0.1's Swift rejects expo-modules-jsi 58.0.22 (JavaScriptObject.swift: "sending 'slot'").
const KNOWN_BAD_XCODE = new Set(["26.0", "26.0.1"]);

const { values } = NodeUtil.parseArgs({
  options: {
    surface: { type: "string", default: "web" },
    dir: { type: "string" },
    origin: { type: "string" },
    home: { type: "string" },
  },
});
const surface =
  values.surface === "mobile" || values.surface === "desktop" ? values.surface : "web";

const ALTERNATIVES = {
  hostBrowser:
    "Use the host-run browser: ask the user to run `node scripts/browser-service.ts` in a host terminal and keep it running, then submit jobs with `node scripts/browser-job.ts`.",
  widerMode: "Ask the user for a wider permission mode (full access) for this agent.",
  otherAgent:
    "Hand this part to a different agent or provider that can start a browser (a Claude agent can).",
  skip: "Skip this surface and say so in the report.",
};

interface Check {
  readonly name: string;
  readonly ok: boolean | null;
  readonly detail: string;
  readonly required: boolean;
  readonly alternatives?: ReadonlyArray<string>;
}

const checks: Array<Check> = [];
const add = (check: Check) => checks.push(check);
const run = (command: string, args: ReadonlyArray<string>) =>
  NodeChildProcess.spawnSync(command, args, { encoding: "utf8", timeout: 20_000 });

const sandbox = process.env.CODEX_SANDBOX;
add({
  name: "sandbox",
  ok: null,
  required: false,
  detail:
    sandbox === undefined
      ? "No Codex sandbox detected."
      : `Codex sandbox "${sandbox}"${process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1" ? " with network off" : ""}: expect no browser, no localhost, no sockets, and no writes outside the checkout and temp folders.`,
});

// The captures folder is also the browser service's job folder.
const browserDir = serviceDir(values.dir);
try {
  NodeFS.mkdirSync(browserDir, { recursive: true });
  const probe = NodePath.join(browserDir, `.preflight-${process.pid}`);
  NodeFS.writeFileSync(probe, "");
  NodeFS.rmSync(probe);
  add({ name: "writeCaptures", ok: true, required: true, detail: `Can write ${browserDir}.` });
} catch (error) {
  add({
    name: "writeCaptures",
    ok: false,
    required: true,
    detail: `Cannot write ${browserDir}: ${(error as NodeJS.ErrnoException).code ?? error}.`,
    alternatives: [ALTERNATIVES.widerMode, ALTERNATIVES.otherAgent],
  });
}

let canLaunch = false;
let appFromService: { origin: string; home: string } | undefined;
if (surface !== "mobile") {
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ timeout: 20_000 });
    await browser.close();
    canLaunch = true;
    add({
      name: "launchBrowser",
      ok: true,
      required: false,
      detail: "This process can start Chromium.",
    });
  } catch (error) {
    const message = (error as Error).message.split("\n")[0] ?? "";
    add({
      name: "launchBrowser",
      ok: false,
      required: false,
      detail: /Executable doesn't exist/.test(message)
        ? "Chromium is not downloaded. Run: node scripts/node_modules/playwright-core/cli.js install --only-shell chromium"
        : `This process cannot start Chromium: ${message}`,
      alternatives: [ALTERNATIVES.hostBrowser, ALTERNATIVES.widerMode, ALTERNATIVES.otherAgent],
    });
  }

  let service:
    | {
        pid: number;
        heartbeatAt: number;
        threads: ReadonlyArray<string>;
        origin: string;
        home: string;
      }
    | undefined;
  try {
    service = JSON.parse(NodeFS.readFileSync(NodePath.join(browserDir, "service.json"), "utf8"));
  } catch {}
  const fresh = service !== undefined && Date.now() - service.heartbeatAt < HEARTBEAT_MS * 3;
  if (fresh && service !== undefined)
    appFromService = { origin: service.origin, home: service.home };
  add({
    name: "hostBrowser",
    ok: fresh,
    required: false,
    detail: fresh
      ? `A browser service (pid ${service?.pid}) is running; submit jobs with node scripts/browser-job.ts. Sample threads: ${service?.threads.join(", ")}.`
      : "No browser service is running for this checkout.",
    ...(fresh ? {} : { alternatives: [ALTERNATIVES.hostBrowser] }),
  });
  add({
    name: "browserPath",
    ok: canLaunch || fresh,
    required: true,
    detail: canLaunch
      ? "Use `node scripts/app-walk.ts` or drive a browser yourself."
      : fresh
        ? "Use the host browser service."
        : "No way to drive a browser from here.",
    ...(canLaunch || fresh
      ? {}
      : {
          alternatives: [
            ALTERNATIVES.hostBrowser,
            ALTERNATIVES.widerMode,
            ALTERNATIVES.otherAgent,
            ALTERNATIVES.skip,
          ],
        }),
  });
}

if (surface === "mobile") {
  const xcode = run("xcodebuild", ["-version"]);
  const version = /Xcode (\S+)/.exec(xcode.stdout ?? "")?.[1];
  add({
    name: "xcode",
    ok: version !== undefined && !KNOWN_BAD_XCODE.has(version),
    required: true,
    detail:
      version === undefined
        ? "Xcode is not installed or not selected."
        : KNOWN_BAD_XCODE.has(version)
          ? `Xcode ${version} cannot compile expo-modules-jsi 58.0.22 (Swift data-race error). A newer Xcode is needed for a local iOS build; an installed dev client still works.`
          : `Xcode ${version}.`,
    alternatives: [
      "Ask the user to install or update Xcode; do not install it yourself.",
      "Use a dev client that is already installed on the simulator.",
      ALTERNATIVES.skip,
    ],
  });
  const pod = run("pod", ["--version"]);
  add({
    name: "cocoapods",
    ok: pod.status === 0,
    required: true,
    detail: pod.status === 0 ? `CocoaPods ${pod.stdout.trim()}.` : "CocoaPods is not installed.",
    alternatives: [
      "Ask the user to install CocoaPods; do not install it yourself.",
      ALTERNATIVES.skip,
    ],
  });
  const simulators = run("xcrun", ["simctl", "list", "devices", "available", "-j"]);
  let iphones: Array<{ name: string; state: string }> = [];
  try {
    const devices = (
      JSON.parse(simulators.stdout) as {
        devices: Record<string, Array<{ name: string; state: string }>>;
      }
    ).devices;
    iphones = Object.values(devices)
      .flat()
      .filter((device) => device.name.startsWith("iPhone"));
  } catch {}
  add({
    name: "simulator",
    ok: iphones.length > 0,
    required: true,
    detail:
      iphones.length > 0
        ? `${iphones.length} iPhone simulators; booted: ${
            iphones
              .filter((device) => device.state === "Booted")
              .map((device) => device.name)
              .join(", ") || "none"
          }.`
        : "No iPhone simulator is available.",
    alternatives: [
      "Ask the user to add a simulator in Xcode; do not change simulators yourself.",
      ALTERNATIVES.skip,
    ],
  });
  const remote = process.env.T3_NATIVE_CLIENT_CACHE;
  const eas = process.env.T3_NATIVE_CLIENT_BUILD === "eas";
  add({
    name: "localOnly",
    ok: remote !== "on" && remote !== "read" && !eas,
    required: false,
    detail:
      remote === "on" || remote === "read" || eas
        ? "T3_NATIVE_CLIENT_CACHE or T3_NATIVE_CLIENT_BUILD sends work to T3 Code's services or EAS. Unset them unless the user asked for that."
        : "Native client builds stay on this machine.",
  });
}

// An app to check: one named here, else the browser service's own.
const origin = values.origin ?? appFromService?.origin;
const home = values.home ?? appFromService?.home;
if (origin !== undefined) {
  const reached = await fetch(`${origin}/.well-known/t3/environment`, {
    signal: AbortSignal.timeout(5_000),
  }).then(
    (response) => (response.ok ? "ok" : `HTTP ${response.status}`),
    (error: Error & { cause?: { code?: string } }) => error.cause?.code ?? error.message,
  );
  add({
    name: "devApp",
    ok: reached === "ok",
    required: values.origin !== undefined,
    detail:
      reached === "ok"
        ? `${origin} answers.`
        : reached === "EPERM"
          ? `This process may not open localhost connections (${reached}); only the file-based browser service works from here.`
          : `${origin} does not answer (${reached}).`,
    alternatives: [ALTERNATIVES.hostBrowser, ALTERNATIVES.widerMode],
  });
}
if (home !== undefined) {
  let settings: {
    defaultModelSelection?: { instanceId?: string };
    providerInstances?: Record<string, { driver?: string; enabled?: boolean }>;
  } = {};
  try {
    settings = JSON.parse(
      NodeFS.readFileSync(NodePath.join(home, "userdata/settings.json"), "utf8"),
    );
  } catch {}
  const instances = settings.providerInstances ?? {};
  const replayDefault = settings.defaultModelSelection?.instanceId === "devReplay";
  const realOn = Object.entries(instances)
    .filter(([id, instance]) => id !== "devReplay" && instance.enabled !== false)
    .map(([id]) => id);
  add({
    name: "replayOnly",
    ok: replayDefault && "devReplay" in instances && realOn.length === 0,
    required: true,
    detail: `Default model ${replayDefault ? "is" : "is NOT"} the replay agent; replay ${"devReplay" in instances ? "is" : "is NOT"} registered${realOn.length > 0 ? `; real providers left on: ${realOn.join(", ")}` : ""}. Providers not listed in settings fall back to their defaults: an app started by app-walk or browser-service turns them all off.`,
    alternatives: [
      "Use `node scripts/app-walk.ts` or the browser service, which start a replay-only app.",
      "Do not send messages in this app.",
    ],
  });
}

add({
  name: "timeLeft",
  ok: null,
  required: false,
  detail:
    "Not knowable from here. Background commands may be stopped after two hours: keep each run short and never restart a shared service mid-run.",
});

const failed = checks.filter((check) => check.required && check.ok === false);
console.log(JSON.stringify({ surface, ok: failed.length === 0, checks }, null, 2));
const mark = (check: Check) =>
  check.ok === null ? "info" : check.ok ? "ok  " : check.required ? "FAIL" : "no  ";
process.stderr.write(
  `\n${checks.map((check) => `${mark(check)}  ${check.name}: ${check.detail}`).join("\n")}\n`,
);
if (failed.length > 0) {
  const options = [...new Set(failed.flatMap((check) => check.alternatives ?? []))];
  process.stderr.write(
    `\nSTOP. This run cannot test ${surface} from here. Tell the user and offer:\n${options.map((option) => `- ${option}`).join("\n")}\n`,
  );
}
process.exit(failed.length > 0 ? 1 : 0);
