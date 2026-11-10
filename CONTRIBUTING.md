# Contributing to Browser Agent

Use the [PRD](docs/product/PRD.md) for product requirements and the [delivery tracker](https://github.com/B-a-1-a/hive/issues/19) to find work. GitHub issues hold assignments, dependencies, decisions, and progress. PRs hold implementation and review evidence.

This guide applies to Browser Agent. The preserved [T3 contribution guide](CONTRIBUTING.upstream.md) is historical reference, not this project's contribution policy.

## Before contributors start

Bala owns [Step One](https://github.com/B-a-1-a/hive/issues/1). Contributor implementation stays blocked until Bala closes it with core validation evidence and announces handoff. A green provenance check or an installed app does not release that gate.

After handoff, follow each issue's remaining dependencies. A closed predecessor does not override an unresolved blocker or a missing agreed interface. The blocked label is a useful signal; read the issue and its native dependency links too.

<a id="claiming-and-coordinating-work"></a>

## Claiming and coordinating work

1. Choose an unassigned issue whose prerequisites are complete. Read its scope, exclusions, acceptance criteria, and linked PRD sections.
2. Claim it in GitHub and assign yourself if you have permission. Otherwise, ask Bala to assign it. Confirm the assignment before implementation so two people do not start the same work.
3. Keep one lead assignee accountable for coordination. Helpers are welcome when their roles and boundaries are clear in the issue.
4. Discuss shared contract or file overlap with the affected issue owners before changing their interfaces. Agree on fixtures so service and UI work can proceed independently.
5. Update the issue when starting, blocked, ready for review, or handing work over. Include the blocker or next action and link the branch or PR when available.

Use a separate branch for the issue. The branch name and planning format are your choice. A substantial scope change needs agreement in the issue before implementation. For an obvious small fix, a concise explanation is enough.

If you stop working on an issue, leave a short handoff with the current code location, checks run, unresolved questions, and next action. Release the assignment or agree on a new lead. Do not replace another person's assignment without coordination.

Agents can help inspect issues and prepare updates. Humans authorize external comments, assignments, PR creation, and merges. Invoking a development skill alone does not authorize those actions.

<a id="prior-approval"></a>

## Understand and implement the change

Read [AGENTS.md](AGENTS.md) and instructions near the affected code. Use the [development runbook](docs/operations/development.md#first-checkout) for setup, repository commands, and platform requirements.

Read the implementation, related tests and contracts, and one existing example before editing. Reuse the inherited foundations rather than building a second browser, provider, scheduler, or orchestration engine.

The [Development Loop skill](.agents/skills/development-loop/SKILL.md) supports this process. Codex discovers it from `.agents/skills` when the repository is open. Invoke it with `$development-loop`. The existing `.claude/skills` link exposes the same files to Claude Code. In other tools, reference the SKILL.md file directly if skill discovery is unavailable.

See [using the skill with different agents and models](docs/operations/ai-development.md) for T3 Code examples and handoffs.

For example: “Use development-loop to implement issue #6. Respect its dependencies and scope, inspect the existing browser services, and verify the changed behavior.”

Choose your own editor, agent, planning format, and development approach within the repository's technical requirements. This guide adds no mandatory planning files, commit frequency, or arbitrary change-size limits.

<a id="one-problem"></a>

## Keep review focused

Keep each PR focused on one underlying problem. Include the related contracts, service, UI, tests, and documentation needed to solve it. Separate unrelated cleanup. Do not split a coherent fix solely to meet a line-count target.

<a id="verification"></a>

## Test and provide evidence

Choose focused checks that exercise the changed behavior. Follow AGENTS.md for repository test conventions and the required pre-push check. Add meaningful regression tests for bugs and important failure cases for new behavior. Use visual evidence for visual-only changes.

In the PR, link the issue and explain the outcome, checks actually run, results, and remaining limits. Include relevant UI captures or interaction evidence. Do not commit PR-only captures or run the entire suite solely to satisfy this guide.

If tooling or platform access prevents a check, say what remains unverified. A failed or unrun check is not a pass.

## Review and completion

Mark the work ready for review when its acceptance criteria and relevant checks are satisfied. Respond to review findings with focused changes and repeat affected checks when needed.

Bala or the maintainer responsible for the area reviews the change. Assignment, a passing check, or a skill's recommendation does not authorize merging. Follow main branch protection. Close the issue after merge and satisfaction of its acceptance criteria, not merely when a draft PR opens.
