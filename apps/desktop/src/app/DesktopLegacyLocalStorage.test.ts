import * as NodePath from "@effect/platform-node/NodePath";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";

import * as DesktopConfig from "./DesktopConfig.ts";
import * as DesktopEnvironment from "./DesktopEnvironment.ts";
import * as DesktopLegacyLocalStorage from "./DesktopLegacyLocalStorage.ts";

it.effect("does not inspect upstream T3 local storage during Browser Agent startup", () => {
  const inspected: string[] = [];
  const environment = DesktopEnvironment.layer({
    dirname: "/repo/apps/desktop/dist-electron",
    homeDirectory: "/Users/alice",
    platform: "darwin",
    processArch: "arm64",
    appVersion: "0.1.1",
    appPath: "/Applications/Browser Agent.app/Contents/Resources/app.asar",
    isPackaged: true,
    resourcesPath: "/Applications/Browser Agent.app/Contents/Resources",
    runningUnderArm64Translation: false,
  }).pipe(Layer.provide(Layer.mergeAll(NodePath.layerPosix, DesktopConfig.layerTest({}))));
  return Effect.gen(function* () {
    const storage = yield* DesktopLegacyLocalStorage.DesktopLegacyLocalStorage;
    yield* storage.load("/isolated/browser-agent");
    assert.isFalse(inspected.some((path) => path.includes("T3 Code") || path.includes("/t3code/")));
  }).pipe(
    Effect.provide(
      DesktopLegacyLocalStorage.layer.pipe(
        Layer.provide(
          Layer.mergeAll(
            environment,
            NodePath.layerPosix,
            FileSystem.layerNoop({
              exists: () => Effect.succeed(false),
              readDirectory: (path) =>
                Effect.sync(() => {
                  inspected.push(path);
                  return [];
                }),
              writeFileString: () => Effect.void,
            }),
          ),
        ),
      ),
    ),
  );
});
