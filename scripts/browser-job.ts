#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off globalTimers:off globalDate:off globalFetch:off globalConsole:off - Plain Node test tooling: it runs before any Effect runtime and inside sandboxes.
// Submits a job to scripts/browser-service.ts and prints its log. It only reads and writes files,
// so it works inside a sandbox with no network, browser, or sockets.
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";

import { HEARTBEAT_MS, parseJob, serviceDir } from "./testing/browser-jobs.ts";

const WAIT_MS = 6 * 60_000;
const NO_SERVICE = [
  "No browser service is running for this checkout.",
  "STOP and tell the user. Options: they start it on the host with `node scripts/browser-service.ts`",
  "and leave it running; they give this agent a wider permission mode; a different agent that can",
  "start a browser does this part; or this surface is skipped.",
].join("\n");

const { values, positionals } = NodeUtil.parseArgs({
  options: { dir: { type: "string" } },
  allowPositionals: true,
});
const dir = serviceDir(values.dir);
const serviceFile = NodePath.join(dir, "service.json");
const alive = () => {
  try {
    const service = JSON.parse(NodeFS.readFileSync(serviceFile, "utf8")) as { heartbeatAt: number };
    return Date.now() - service.heartbeatAt < HEARTBEAT_MS * 3;
  } catch {
    return false;
  }
};

const [file] = positionals;
if (file === undefined) {
  console.error("Usage: node scripts/browser-job.ts <job.json>");
  process.exit(2);
}
let text: string;
try {
  text = NodeFS.readFileSync(file, "utf8");
  parseJob(text);
} catch (error) {
  console.error(`${file}: ${(error as Error).message}`);
  process.exit(2);
}
if (!alive()) {
  console.error(NO_SERVICE);
  process.exit(3);
}

const name = `${Date.now()}-${NodeCrypto.randomBytes(4).toString("hex")}.json`;
const queued = NodePath.join(dir, "jobs", name);
NodeFS.writeFileSync(`${queued}.tmp`, text);
NodeFS.renameSync(`${queued}.tmp`, queued);
const resultFile = NodePath.join(dir, "results", name);
const deadline = Date.now() + WAIT_MS;
for (;;) {
  if (NodeFS.existsSync(resultFile)) break;
  if (!alive()) {
    console.error(`The browser service stopped before finishing this job.\n${NO_SERVICE}`);
    process.exit(3);
  }
  if (Date.now() > deadline) {
    console.error(`No result after ${WAIT_MS / 60_000} minutes. The job file is ${queued}.`);
    process.exit(4);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
const result = JSON.parse(NodeFS.readFileSync(resultFile, "utf8")) as {
  ok: boolean;
  log: Array<string>;
};
NodeFS.rmSync(resultFile, { force: true });
console.log(result.log.join("\n"));
console.log(`\nCaptures: ${NodePath.join(dir, "captures")}`);
process.exit(result.ok ? 0 : 1);
