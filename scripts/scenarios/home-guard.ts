// @effect-diagnostics nodeBuiltinImport:off - Pure path checks, shared with plain Node tooling.
// Test runs recreate their Hive home from scratch, so the folder they delete must be one a test
// run made. A marker file names the run that owns it; a live owner means another run uses it.
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

export const HOME_MARKER = ".hive-test-home";

export interface HomeState {
  /** The home, resolved through symlinks where it exists. */
  readonly home: string;
  /** Entries in the home, or undefined when it does not exist. */
  readonly entries: ReadonlyArray<string> | undefined;
  /** PID written in the marker file, or undefined when there is none. */
  readonly ownerPid: number | undefined;
}

/** Folders no test run may delete, or delete a parent of: real homes and the checkout. */
export const protectedPaths = (checkout: string, userHome = NodeOS.homedir()) => [
  userHome,
  NodePath.join(userHome, ".hive"),
  NodePath.join(userHome, ".t3"),
  checkout,
];

const contains = (parent: string, child: string) => {
  const relative = NodePath.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !NodePath.isAbsolute(relative));
};

/** Why this home must not be recreated, or undefined when it is safe to. */
export function refuseToRecreate(
  state: HomeState,
  protectedList: ReadonlyArray<string>,
  isAlive: (pid: number) => boolean,
): string | undefined {
  const guarded = protectedList.find((path) => contains(state.home, path));
  if (guarded !== undefined) {
    return `${state.home} is or contains ${guarded}; a test home must be its own folder.`;
  }
  if (state.entries === undefined || state.entries.length === 0) return undefined;
  if (!state.entries.includes(HOME_MARKER)) {
    return `${state.home} is not empty and no test run made it. Remove it yourself if it is a test home.`;
  }
  if (state.ownerPid !== undefined && isAlive(state.ownerPid)) {
    return `${state.home} is in use by another test run (pid ${state.ownerPid}). Use another home.`;
  }
  return undefined;
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
