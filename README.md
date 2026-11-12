# Hive

Hive is an independently branded desktop app based on the complete T3 Code v0.1.9 stable source. The upstream features, provider integrations, settings UI, and built-in browser remain in place. This refresh changes app branding and identity, with a clean Hive profile.

## Development

Use the versions pinned in `package.json` and `pnpm-workspace.yaml` (Node 26.12.1, pnpm 12.14.0, Vite+ 1.4.0).

```sh
vp install --frozen-lockfile
T3CODE_DEV_SEED=0 vp run dev:desktop --home-dir "$PWD/.hive" --no-seed
```

Internal `T3CODE_*` configuration keys and package names remain compatible with upstream. Hive's default application data is separate from T3 Code and the previous Browser Agent checkout. This handoff targets the Mac desktop app. Mobile release identifiers remain upstream-compatible; no separately installable Hive mobile package is included.

Existing provider CLI sign-ins can be reused where supported; old app conversations and settings are not imported.

For source builds and other development commands, see [Development](docs/operations/development.md). Provider setup follows the inherited [install guide](docs/user/install.md). The refreshed app keeps upstream provider support; this does not mean every provider account or hosted service has been independently certified.

## Current direction

Bala is shaping the app before creating a new contributor backlog. The old contributor backlog, PRD, and wireframes have been discarded. New work will be defined from the product vision after this baseline.

Later, browser use and computer use will be wrapped as built-in, non-removable plugins using [agent-browser](https://github.com/vercel-labs/agent-browser) and [agent-desktop](https://github.com/vercel-labs/agent-desktop). Neither is added in this refresh. All inherited features, including the built-in browser, remain functional until a later explicit change.

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [development loop](.agents/skills/development-loop/SKILL.md) before contributing. Further product changes happen step by step at Bala's direction.

## Source and licensing

[UPSTREAM.json](UPSTREAM.json) records the pinned source and archive checksum. [README.upstream.md](README.upstream.md) preserves upstream documentation. Imported code retains its [MIT notice](LICENSE.upstream); this repository's existing [LICENSE](LICENSE) is preserved. External provider names, hosted T3 services, and original attribution remain accurate.
