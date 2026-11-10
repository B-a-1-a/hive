import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { resolveUserDataPath } from "./DesktopUserData.ts";

it.effect.each(["browser-agent-legacy", "Browser Agent (Alpha)"])(
  "preserves Windows credential keys from %s without copying browser databases",
  (sourceName) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "t3-v2-profile-" });
      const source = path.join(directory, sourceName);
      const destination = path.join(directory, "browser-agent");
      const state = '{"os_crypt":{"encrypted_key":"test-encrypted-key"}}';
      yield* fs.makeDirectory(path.join(directory, "Browser Agent (Alpha)"), { recursive: true });
      yield* fs.makeDirectory(path.join(source, "IndexedDB"), { recursive: true });
      yield* fs.writeFileString(path.join(source, "Local State"), state);
      yield* fs.writeFileString(path.join(source, "IndexedDB", "LOCK"), "V1 owns this database");
      yield* resolveUserDataPath({
        appDataDirectory: directory,
        isDevelopment: false,
        platform: "win32",
      });
      assert.equal(yield* fs.readFileString(path.join(destination, "Local State")), state);
      assert.equal(yield* fs.readFileString(path.join(source, "Local State")), state);
      assert.isFalse(yield* fs.exists(path.join(destination, "IndexedDB")));
      yield* fs.writeFileString(path.join(destination, "Local State"), "existing V2 state");
      yield* resolveUserDataPath({
        appDataDirectory: directory,
        isDevelopment: false,
        platform: "win32",
      });
      assert.equal(
        yield* fs.readFileString(path.join(destination, "Local State")),
        "existing V2 state",
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect.each([
  { platform: "darwin", isDevelopment: true, folder: "browser-agent-dev" },
  { platform: "darwin", isDevelopment: false, folder: "browser-agent" },
  { platform: "win32", isDevelopment: false, folder: "browser-agent" },
] as const)(
  "keeps Browser Agent separate from T3 profiles on $platform (development: $isDevelopment)",
  ({ platform, isDevelopment, folder }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "browser-agent-profile-" });
      for (const legacy of ["T3 Code (Dev)", "T3 Code (Alpha)", "t3code", "t3code-v2"]) {
        yield* fs.makeDirectory(path.join(directory, legacy), { recursive: true });
        yield* fs.writeFileString(path.join(directory, legacy, "Local State"), "upstream-state");
      }
      const resolved = yield* resolveUserDataPath({
        appDataDirectory: directory,
        platform,
        isDevelopment,
      });
      assert.equal(resolved, path.join(directory, folder));
      assert.isFalse(yield* fs.exists(path.join(resolved, "Local State")));
      assert.equal(
        yield* fs.readFileString(path.join(directory, "T3 Code (Alpha)", "Local State")),
        "upstream-state",
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);
