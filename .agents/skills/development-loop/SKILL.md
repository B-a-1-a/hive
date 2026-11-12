---
name: development-loop
description: Clarify intended behavior, implement focused changes, and coordinate testing and fixes for Hive features, bug fixes, and refactors. Use proactively for nontrivial development or when explicitly invoked; scale effort to the task.
---

# Development Loop

Help the contributor deliver a change they understand and can explain, with evidence that the affected behavior works. Briefly mention that you are using this loop, then proceed within the requested scope. Developers can also invoke `$development-loop` directly, including for just clarification or testing. Small fixes need proportionate checks; they do not need a separate specification or testing agent.

## Establish the task and context

Read the repository's [AGENTS.md](../../../AGENTS.md) and any nearer instructions. Follow [CONTRIBUTING.md](../../../CONTRIBUTING.md) for ownership and dependency checks. GitHub issues hold shared assignments and progress. Personal agent memory is not team approval or an assignment record.

For an issue-based task, read its outcome, scope exclusions, acceptance criteria, and dependencies. The previous contributor backlog is superseded; follow Bala's current owner-led scope. Do not take over another contributor's work. Posting comments, assigning issues, opening PRs, and merging require the user's authorization for those actions.

Read the files to change, related contracts and tests, and an existing example of the same pattern. Trace the relevant caller and consumer when crossing a boundary. Use the current direction in [README.md](../../../README.md); historical product documents are not active assignments. Do not infer behavior from a filename or an agent's previous summary alone.

Start from the developer's intended experience. Summarize the scope and a few observable acceptance criteria, reusing the issue or existing specification when sufficient. Ask focused questions only about unresolved behavior, scope, ownership, or compatibility. Resolve routine technical details from the code. Do not require a planning document or a confirmation round when the request is clear. Continue independent work while awaiting a needed decision.

## Make a focused change

Follow Theo's guidance in AGENTS.md: understand the real constraint and choose the smallest coherent implementation. Reuse the existing services and adapters. Keep changes within the issue's ownership boundary and preserve unrelated edits. Coordinate shared contracts before changing dependent implementations. One implementation agent is normally enough.

Choose a reviewable increment that leaves a coherent path through the affected code. Avoid unrelated cleanup and speculative abstractions. Contributors choose their planning format, tools, and commit cadence. No extra plan document, line-count limit, or automatic commit is required by this skill.

## Verify the affected behavior

Choose checks that can reveal a real failure:

- For a logic, state, data, or protocol bug, reproduce the failure with a focused regression test as required by AGENTS.md. Then demonstrate that the fix passes.
- For new behavior, extend the relevant behavior tests, including important error or boundary cases. Do not add tests that only repeat the implementation.
- For UI behavior, check the actual interaction when authorized. For visual-only changes, use before/after captures rather than implementation-mirroring tests.
- For shared contracts or migrations, check affected consumers, compatibility, and recovery paths. For permissions or external actions, include denial and stale-state cases.
- For documentation-only changes, check examples, commands, links, and the skill format where relevant. Application tests are unnecessary unless behavior also changes.

Use repository commands and the smallest relevant test set. Examples include `vp test run <test-files>` during implementation and `vp run check:changed <baseline-ref>` before pushing. Select a real comparison base for the change. Let CI own repo-wide suites unless the user requests them.

Investigate a failure before retrying or expanding checks. Do not weaken tests to get a pass. If tools, credentials, or platform access prevent a check, record what remains unverified. Never report an unrun check as passing.

## Independently test and fix

For nontrivial implementation work, use an independent testing agent when delegation is available. Check the environment's capabilities and honor the developer's model preferences. A different available model can provide another perspective but is optional. In T3, use its existing delegation and follow-up tools; see [the development guide](../../../docs/operations/ai-development.md#choose-manual-handoffs-or-t3-delegation) for handoff mechanics. Do not add orchestration infrastructure for this workflow.

Give the tester the acceptance criteria, relevant context, this skill, allowed actions, and the exact implementation commit or stable working-tree diff. Keep one implementation writer and avoid edits while the tester checks that version. The lead owns the dev server; the tester reuses it and the existing `test-t3-app` skill for applicable UI checks. An isolated worktree must contain the actual changes under test.

The lead coordinates this loop without asking the developer to relay messages:

1. The tester independently checks the acceptance criteria, runs relevant checks, and exercises affected behavior. It reports failures with reproduction steps, expected/actual results, and evidence, rather than relying on the implementer's claims.
2. The implementation agent investigates and fixes confirmed failures within scope, then supplies the updated code version and check results. Resolve disputed findings against the criteria and evidence; do not weaken tests or silently change the criteria to obtain a pass.
3. The tester checks the updated version, reruns failed checks and relevant regression checks, and reports which criteria pass or remain unresolved. Repeat with the implementation agent until all acceptance criteria pass.

If progress stalls, agents cannot resolve a disagreement, a required tool is unavailable, or further work needs a scope or product decision, report the specific blocker and unresolved criteria. Do not loop indefinitely or claim completion. If independent delegation is unavailable, perform the checks yourself and disclose the missing independent pass. A code review alone is not evidence that an untested interaction works.

## Review and hand off

Inspect the final diff for scope, regressions, accidental secrets, and unrelated edits. Compare the result with the acceptance criteria. Explain anything the evidence does not establish.

Summarize what changed and why, the checks actually run and their results, and remaining limitations or follow-up. When authorized to update GitHub, put the evidence and current status on the issue or linked PR. An implementation awaiting review is not a completed issue.
