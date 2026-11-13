# Browser jobs for agents that cannot start a browser

A host-run service plays JSON job files in a real browser. Agents only read and
write files, which works inside a Codex sandbox.

## Start (the user or a host agent, once)

```bash
node scripts/browser-service.ts
```

It starts its own isolated app (temp folder outside any repository, replay as
the only model, every real provider off, sample projects and threads), waits for
jobs in `.hive/browser/jobs`, and writes `.hive/browser/service.json` every few
seconds. Ctrl+C stops the app and the browser. Never restart it while agents use
it: their jobs fail. A second copy refuses to start.

## Submit (any agent, working directory = the checkout)

```bash
node scripts/browser-job.ts my-job.json
```

It waits for the result and prints the log. Exit codes: 0 done, 1 a step failed
(the log lists the visible controls and saves `captures/<agent>/_last-error.png`),
2 the job file is invalid, 3 no service is running (STOP and tell the user),
4 no result after six minutes.

```json
{
  "agent": "settings-walker",
  "viewport": { "width": 1440, "height": 900 },
  "colorScheme": "light",
  "steps": [
    { "do": "goto", "path": "/settings/general" },
    { "do": "shot", "id": "settings-general", "title": "General settings", "scroll": true },
    { "do": "goto", "path": "thread:approval" },
    { "do": "click", "role": "button", "name": "Add project" },
    {
      "do": "shot",
      "id": "add-project",
      "title": "Add project dialog",
      "how": "Sidebar > Add project"
    }
  ]
}
```

- `agent`: lowercase name. Your captures go to `.hive/browser/captures/<agent>/`
  with a `manifest.jsonl`. Each agent gets its own browser storage, cleared at the
  start of every job, so jobs start from the same layout. Server data is shared.
- `viewport` and `colorScheme` are optional. At most 40 steps per job.
- `goto`: `path` starts with `/`, or names a sample thread: `thread:git`,
  `thread:plain`, `thread:question`, `thread:approval`.
- Find an element with one of `role` plus `name`, `text`, `label`,
  `placeholder`, or `css`; add `exact`, `nth`, or `within` (a CSS selector).
  `click` and `hover` also take `x` and `y`. `click` takes `"button": "right"`
  and `"double": true`.
- `fill` (locator plus `value`), `type` (`value` into the focused element),
  `press` (`key`, such as `Escape` or `Meta+k`), `wheel` (`dy`, optional `x`, `y`),
  `waitFor` (locator, `"gone": true` to wait until it disappears).
- `dump` lists the visible controls with positions; `"withText": true` adds the page text.
- `shot`: `id` in kebab-case, plus `title`, `how`, `notes`. `"scroll": true`
  also captures the rest of a long page. A shot of an error page, a page with
  script errors, or a broken route fails instead of saving. Look at every image.
- `"optional": true` on a step skips it on failure instead of ending the job.

Every request that would leave this machine is blocked. Do not send messages
with a non-replay model, sign in to anything, or confirm delete, commit, push,
publish, or reset: open the dialog, capture it, press Escape.
