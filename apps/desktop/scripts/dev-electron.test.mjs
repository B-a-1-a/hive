import * as NodeEvents from "node:events";
import { afterEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(),
  execFileSync: vi.fn(),
  watch: vi.fn(),
}));
vi.mock("node:child_process", () => mocks);
vi.mock("node:fs", () => ({ watch: mocks.watch }));
vi.mock("node:os", () => ({ platform: () => "darwin" }));
vi.mock("./electron-launcher.mjs", () => ({
  desktopDir: "/checkout/apps/desktop",
  resolveDevProtocolClient: () => null,
  resolveElectronLaunchCommand: (args) => ({ electronPath: "/runtime/Electron", args }),
}));
vi.mock("./wait-for-resources.mjs", () => ({ waitForResources: async () => {} }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("starts and reloads only its captured app without sweeping other worktree processes", async () => {
  vi.useFakeTimers();
  vi.stubEnv("VITE_DEV_SERVER_URL", "http://127.0.0.1:9000");
  const apps = [];
  mocks.spawn.mockImplementation(() => {
    const app = new NodeEvents.EventEmitter();
    app.pid = 5000 + apps.length;
    app.kill = vi.fn((signal) => app.emit("exit", null, signal));
    apps.push(app);
    return app;
  });
  const watchers = [];
  mocks.watch.mockImplementation((_path, _options, callback) => {
    watchers.push(callback);
    return { close: vi.fn() };
  });
  // Retain shutdown handlers without installing them on the test runner.
  const handlers = new Map();
  vi.spyOn(process, "once").mockImplementation((event, handler) => {
    handlers.set(event, handler);
    return process;
  });
  await import("./dev-electron.mjs");
  expect(apps).toHaveLength(1);
  expect(mocks.spawnSync).not.toHaveBeenCalled();

  watchers[0]("change", "main.cjs");
  await vi.advanceTimersByTimeAsync(120);
  expect(apps[0].kill).toHaveBeenCalledWith("SIGTERM");
  expect(apps).toHaveLength(2);
  expect(mocks.spawnSync.mock.calls).toEqual([
    ["pkill", ["-TERM", "-P", "5000"], { stdio: "ignore" }],
  ]);
  const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined);
  handlers.get("SIGTERM")();
  await vi.advanceTimersByTimeAsync(1_201);
  expect(apps[1].kill).toHaveBeenCalledWith("SIGTERM");
  expect(mocks.spawnSync.mock.calls.slice(1)).toEqual([
    ["pkill", ["-TERM", "-P", "5001"], { stdio: "ignore" }],
    ["pkill", ["-TERM", "-P", String(process.pid)], { stdio: "ignore" }],
    ["pkill", ["-KILL", "-P", String(process.pid)], { stdio: "ignore" }],
  ]);
  expect(exit).toHaveBeenCalledWith(143);
});
