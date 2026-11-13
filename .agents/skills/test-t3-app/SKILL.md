---
name: test-t3-app
description: Test T3 Code's web and desktop UI through its built-in Browser panel, the scripted app walk, or the host-run browser service, against isolated development state. Use for browser verification, screenshots of the app, browser pairing recovery, and test fixtures. Use test-t3-mobile for native mobile verification.
---

# Test T3 web and desktop

For native mobile testing, use [test-t3-mobile](../test-t3-mobile/SKILL.md).

## Run the preflight first

```bash
node scripts/test-preflight.ts            # --surface mobile for the iOS app
```

It prints one JSON object, then a plain summary. When it exits 1, STOP: tell the
user what failed and offer the alternatives it lists (start the host browser
service, a wider permission mode, a different agent, or skipping that surface).
Do not improvise another way to get a browser, and do not install anything.

## Pick a path

- **Whole app, no agent needed:** `node scripts/app-walk.ts` starts its own
  isolated app (data in a temp folder outside any repository, replay as the
  only model, every real provider off), seeds a plain-folder project and a git
  project with replay threads (one waiting on a question, one on an approval),
  visits every route and the main menus, and writes screenshots plus
  `manifest.json` (route, how to reach it, theme, visible controls with boxes).
  A page that redirects, shows an error, or names this machine is recorded as
  such, never saved as a capture. `--only <ids>`, `--theme dark`, `--keep`.
  It takes two to three minutes and stops everything it started.
- **A specific flow, and this process can start a browser:** use T3's Browser
  panel (below), or the app the walk leaves up with `--keep`.
- **This process cannot start a browser** (sandboxed Codex agents): use the
  host browser service, see [references/browser-jobs.md](references/browser-jobs.md).

## Start an app yourself

Prefer the walk or the service: both start a safe app. If you need `vp run dev`,
use `vp run dev --no-seed --no-auto-bootstrap-project-from-cwd`. Without them it
copies the developer's real threads into the worktree's `.hive` and adds the
checkout's `apps/server` folder as a project, where git actions reach real code.
Read the ports and pairing URL from the dev-runner output. Never run against
`~/.hive/userdata` or `~/.t3/userdata`, and never set `VITE_HTTP_URL` or `VITE_WS_URL`.
Pass the same `--base-dir` to every `node apps/server/src/bin.ts` command (pair,
thread, project): without it they pick another home.

Read [references/sqlite-fixtures.md](references/sqlite-fixtures.md) only when
inspecting or seeding SQLite. Stop the test server before direct fixture writes.

## Drive agent turns for free

Never send a message with a paid model. `vp run dev` and desktop dev register
the `Replay (dev)` provider, which replays recorded turns through the real
adapter and orchestration. Its models are scenarios: `showcase`, `todo-list`,
`approval`, `question`, `multi-turn`. Press `Ctrl+Alt+Shift+R` for a picker,
call `window.t3dev.replay("showcase")` with `preview_evaluate`, or run
`node apps/server/src/bin.ts thread start --base-dir .hive --provider devReplay --model showcase <project> "go"`.
A default model is not a guarantee: thread titles, commit messages, and a
thread or project that picked another model still reach real providers. The
walk and the service turn those providers off; an app you started does not.

## Use the Browser panel

Call `preview_status`. If no tab can be automated, call `preview_open`, including
when status reports `available: false` or `tabId: null`. Navigate to the full
startup pairing URL once with `preview_navigate`, then use `preview_snapshot`
and T3's interaction tools. Changing only the hash of an open `/pair` page does
not sign in; load the URL fresh. If the token was used, run
`node apps/server/src/bin.ts pair --base-dir <home>` for a new one (it lasts 5
minutes). `preview_snapshot` can time out while the user is not looking at the
thread; `preview_evaluate` still works.

## Desktop

`vp run dev:desktop` serves the app at `hive-dev://app/#/<path>`.
`T3CODE_DESKTOP_REMOTE_DEBUGGING_PORT` exposes it over CDP, and
`T3CODE_DESKTOP_DEV_APP_DATA_DIR` keeps its Electron profile out of the
developer's `hive-dev` one. Starting it registers the `hive-dev://` handler with
macOS, so ask the user first. Native menus and dialogs do not show in CDP
screenshots; never open a folder picker or permission prompt.

## Several agents at once

- Run one probe agent through the preflight and one small job before starting more.
- Give each agent one flow and at most about 25 captures, with its own `agent` name.
- Never restart a shared app or browser service while agents use it.
- Agents share the app's server state: an agent that changes a setting changes it
  for everyone, so change it back in the same job.
- Do not run a native build while capturing; it slows every job.
- Sandboxed Codex agents can read files, run node, and write in the checkout and
  temp folders. They cannot start a browser, open localhost or unix sockets, or
  write to the home folder. They use the browser service only.

## Verify and retain

Exercise the affected flow and capture the state that proves it works. Keep the
server, state, and panel available while the user inspects or iterates. Stop
only processes you started, by the PID you captured. Keep credentials and
pairing URLs out of screenshots, commits, and replies.
