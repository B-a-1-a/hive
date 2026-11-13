// @effect-diagnostics nodeBuiltinImport:off globalTimers:off globalDate:off globalFetch:off globalConsole:off - Plain Node test tooling: it runs before any Effect runtime and inside sandboxes.
// The file format between scripts/browser-job.ts (agents) and scripts/browser-service.ts (host).
// Jobs are data: a fixed list of browser actions, never code to run.
import * as NodePath from "node:path";

const CHECKOUT = NodePath.resolve(import.meta.dirname, "../..");

/** The service rewrites service.json this often; three missed beats mean it is gone. */
export const HEARTBEAT_MS = 5_000;
const MAX_STEPS = 40;
const AGENT = /^[a-z][a-z0-9-]{1,30}$/;
const SHOT_ID = /^[a-z0-9][a-z0-9-]{2,90}$/;
const ACTIONS = new Set([
  "goto",
  "click",
  "hover",
  "fill",
  "type",
  "press",
  "wheel",
  "waitFor",
  "dump",
  "shot",
]);

/** Inside the checkout, the one place a sandboxed agent can always write. */
export const serviceDir = (dir?: string) =>
  NodePath.resolve(dir ?? NodePath.join(CHECKOUT, ".hive/browser"));

export interface Step {
  readonly do: string;
  readonly path?: string;
  readonly role?: string;
  readonly name?: string;
  readonly text?: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly css?: string;
  readonly within?: string;
  readonly exact?: boolean;
  readonly nth?: number;
  readonly x?: number;
  readonly y?: number;
  readonly button?: "left" | "right";
  readonly double?: boolean;
  readonly value?: string;
  readonly key?: string;
  readonly dy?: number;
  readonly gone?: boolean;
  readonly withText?: boolean;
  readonly id?: string;
  readonly title?: string;
  readonly how?: string;
  readonly notes?: string;
  readonly scroll?: boolean;
  readonly list?: boolean;
  readonly optional?: boolean;
}

export interface Job {
  /** Names the agent: its captures folder, and its own browser storage. */
  readonly agent: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly colorScheme: "light" | "dark";
  readonly steps: ReadonlyArray<Step>;
}

/** Validates a job file's text, or throws with what is wrong in plain words. */
export function parseJob(text: string): Job {
  const raw = JSON.parse(text) as Partial<Job> & { viewport?: Partial<Job["viewport"]> };
  if (typeof raw.agent !== "string" || !AGENT.test(raw.agent)) {
    throw new Error(`"agent" must match ${AGENT}, for example "settings-walker".`);
  }
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    throw new Error(`"steps" must be a non-empty list.`);
  }
  if (raw.steps.length > MAX_STEPS) {
    throw new Error(`At most ${MAX_STEPS} steps per job; split it into several jobs.`);
  }
  for (const [index, step] of raw.steps.entries()) {
    if (!ACTIONS.has(step.do)) {
      throw new Error(`Step ${index + 1}: "do" must be one of ${[...ACTIONS].join(", ")}.`);
    }
    if (step.do === "goto" && !/^(\/|thread:)/.test(step.path ?? "")) {
      throw new Error(`Step ${index + 1}: "path" must start with "/" or "thread:".`);
    }
    if (step.do === "shot" && !SHOT_ID.test(step.id ?? "")) {
      throw new Error(
        `Step ${index + 1}: shot "id" must be kebab-case, for example "settings-general".`,
      );
    }
  }
  const clamp = (value: number | undefined, fallback: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.round(value ?? fallback)));
  return {
    agent: raw.agent,
    viewport: {
      width: clamp(raw.viewport?.width, 1440, 320, 2400),
      height: clamp(raw.viewport?.height, 900, 400, 1600),
    },
    colorScheme: raw.colorScheme === "dark" ? "dark" : "light",
    steps: raw.steps,
  };
}
