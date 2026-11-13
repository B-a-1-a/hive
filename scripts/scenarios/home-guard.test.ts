import { describe, expect, it } from "vite-plus/test";

import { HOME_MARKER, protectedPaths, refuseToRecreate } from "./home-guard.ts";

const guarded = protectedPaths("/work/hive", "/Users/dev");
const alive = (pid: number) => pid === 42;

describe("refuseToRecreate", () => {
  it.each([
    ["a missing home", { home: "/tmp/walk/home", entries: undefined, ownerPid: undefined }],
    ["an empty home", { home: "/tmp/walk/home", entries: [], ownerPid: undefined }],
    ["a finished run's home", { home: "/tmp/walk/home", entries: [HOME_MARKER], ownerPid: 7 }],
  ])("recreates %s", (_name, state) => {
    expect(refuseToRecreate(state, guarded, alive)).toBeUndefined();
  });

  it.each([
    ["the user's home", "/Users/dev", ["Documents"], undefined, "is or contains"],
    ["the live Hive home", "/Users/dev/.hive", [HOME_MARKER], undefined, "is or contains"],
    ["a parent of the checkout", "/work", [HOME_MARKER], undefined, "is or contains"],
    ["the filesystem root", "/", [HOME_MARKER], undefined, "is or contains"],
    ["a folder no run made", "/tmp/walk/home", ["notes.txt"], undefined, "no test run made"],
    ["a home a live run owns", "/tmp/walk/home", [HOME_MARKER], 42, "in use"],
  ])("refuses %s", (_name, home, entries, ownerPid, reason) => {
    expect(refuseToRecreate({ home, entries, ownerPid }, guarded, alive)).toContain(reason);
  });
});
