# Using Development Loop with T3 Code

Development Loop is a short set of instructions for understanding code, making focused changes, testing behavior, and reporting evidence. It does not start agents, select models, run a permanent loop, or enforce tests automatically. The selected agent follows the instructions and runs the available tools. T3 Code manages the sessions and delegation.

## Start a task

Open this repository as a project in T3 Code. Select an enabled provider and an available model in the composer. Type `$` and select `development-loop`, then describe the task. Codex reads the project's `.agents/skills`; the repository's `.claude/skills` link exposes the same skill to Claude Code.

If a new or changed skill is missing, use **Restart agent session** in the command palette. Check that the provider is enabled for the project. If skill discovery is unavailable, ask the agent to read `.agents/skills/development-loop/SKILL.md` directly.

For example:

```text
Use $development-loop for issue #<ready issue>.
Check its dependencies and scope first. Read the relevant implementation,
contracts, and tests. Make the agreed change, run appropriate checks,
and report what changed, what passed, and what remains unverified.
```

Bala's Step One gate still applies. Invoking the skill does not release blocked issues, assign a task, or authorize a merge.

## Use different agents for different roles

You can use the same skill with different providers or models. Give each agent an explicit role, scope, and output. Choose from the models available to your connected accounts. Model choice does not grant tools or permissions that its provider lacks.

| Role           | Assignment                                                                                                                      | Handoff                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Specification  | Read the issue, relevant PRD sections, code, and tests. Explain current behavior and propose completion checks. Read only.      | Agreed behavior, interfaces, scope exclusions, and acceptance checks.       |
| Implementation | Implement the agreed change on the issue branch or an isolated worktree. Run affected checks.                                   | Exact commit or diff, test commands/results, and known limits.              |
| UI testing     | Exercise the agreed flow in the running development app with available browser tools. Capture states, errors, and interactions. | Reproduction steps, expected/actual behavior, and captures.                 |
| Review         | Independently inspect the implementation and test its acceptance criteria. Read only unless fixes are authorized.               | Findings with evidence, remaining risks, or a clear assessment of coverage. |

A reasoning-focused model can handle specification work, a coding model can implement, and a model with suitable browser tools can test the UI. Use an independent reviewer when the change warrants it. Roles do not require separate models for every small fix.

For UI work, the inherited `test-t3-app` skill describes T3's Browser-panel testing path. If those tools are unavailable, report the gap. Passing unit tests alone does not establish that the UI interaction works.

## Choose manual handoffs or T3 delegation

For manual handoffs, create a thread for each role and select its provider/model in the composer. Pass the specification and the exact implementation commit to the next agent. Keep one lead contributor accountable in the GitHub issue.

For coordinated work, ask a lead agent inside T3 to use its app-owned delegation tools:

```text
Use $development-loop to coordinate this ready issue.
Check orchestrator_capabilities and the available provider/model choices first.
Delegate read-only specification analysis, then implementation of the agreed
scope, then an independent review and UI check. Use the provider/model choices
I specify when supported. Give each child the skill path, its role, acceptance
criteria, exact code version, and allowed actions. Report each child's actual
provider/model and evidence. Keep GitHub updates and merging under my control.
```

T3's `delegate_task` supports cross-provider/model children. A child receives the supplied brief, not the entire parent conversation. Explicitly include the relevant context and skill path in that brief. Native provider subagents can have different model and option limits, so use T3's reported capabilities rather than assuming compatibility.

Use separate worktrees for independent implementation writers. T3 worktree delegation starts from a local commit and does not copy uncommitted edits. The reviewer must inspect the implementation's exact commit; a separate worktree on an older commit will miss the changes. Read-only analysis can share a checkout when it will stay unchanged during the check.

Shift-clicking several models in a new-thread picker creates separate threads and worktrees for the same prompt. It is useful for comparing approaches, but it does not define a sequential specification → implementation → testing workflow.

## Difference from Addy Osmani's skills

[Context engineering](https://github.com/addyosmani/agent-skills/blob/main/skills/context-engineering/SKILL.md) provides broader guidance on supplying context and managing sessions. [Incremental implementation](https://github.com/addyosmani/agent-skills/blob/main/skills/incremental-implementation/SKILL.md) describes thin implementation slices, testing, verification, and per-slice commits.

Our skill combines the relevant habits in one short, project-specific entry point. It follows this repository's commands and GitHub dependency process. It adapts verification to the change and adds no mandatory planning documents, commit cadence, or arbitrary line limits. Existing technical requirements in AGENTS.md still apply.

The skill is original project guidance informed by those general practices. It is not an installation of Addy's full collection. You can use specialized skills for a difficult debugging, testing, or review task when they help.

## Relevant inherited guidance

- [Commands and skill selection](../user/composer.md#commands-and-skills)
- [Provider-specific Claude skill discovery](../user/providers-claude.md#skills)
- [Threads, model selection, and delegated agents](../user/thread-sidebar.md)
- [Development commands and isolated desktop startup](development.md)
- [Task ownership and contribution process](../../CONTRIBUTING.md)
