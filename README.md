# Hive

An open-source desktop agent orchestrator for browser and file work.

Project overview, installation instructions, and screenshots are coming soon.

## Starting point

We are working from **T3 Code v0.1.2** as the project base. This repository contains a manually copied source snapshot, not a GitHub fork.

- Upstream: [pingdotgg/t3code](https://github.com/pingdotgg/t3code)
- Release: [v0.1.2](https://github.com/pingdotgg/t3code/releases/tag/v0.1.2)
- Source commit: `044f07257c9684ae4543bd1e1ebf9c394e9e3830`
- Original project documentation: [README.upstream.md](README.upstream.md)
- Import record: [UPSTREAM.json](UPSTREAM.json)

The repository's existing [AGPL-3.0 license](LICENSE) is retained. T3 Code's [MIT license](LICENSE.upstream) and embedded third-party notices are preserved.

## Development status

**Phase 1 is owned by Bala and must finish before parallel contributor work starts.** It will establish and verify the inherited desktop app, provider sign-in and session lifecycle, durable orchestration and delegation, queues and schedules, built-in browser profiles and takeover, permissions, local files and artifacts, recovery, application identity and update configuration, and the full build/test pipeline.

Start with the [PRD](docs/product/PRD.md) and [implementation tracker](https://github.com/B-a-1-a/hive/issues/19). [Step 1](https://github.com/B-a-1-a/hive/issues/1) is assigned to Bala. Contributor implementation stays blocked until Bala closes it with core validation evidence and announces handoff. Each issue defines its dependencies, ownership boundary, scope exclusions, acceptance criteria, and verification evidence.

The imported toolchain is Node **26.12.1** and pnpm **12.14.0**. See the [upstream development guide](docs/operations/development.md) for the inherited setup commands. Upstream release and deployment workflows are archived under `.github/upstream-workflows/t3-v0.1.2/`; they are not active in this repository.

## Product outline

[Product text and interactive wireframes](docs/design/product-outline.html)

## Contributing

Read the [contributor guide](CONTRIBUTING.md) for task claiming, dependencies, coordination, and review. The repo includes a [Development Loop skill](.agents/skills/development-loop/SKILL.md) for understanding the code, making focused changes, and testing the affected behavior. Invoke it with `$development-loop` in Codex, or reference the skill file in your coding tool.
