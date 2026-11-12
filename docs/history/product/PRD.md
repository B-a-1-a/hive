# Browser Agent product requirements

Version 0.1 • October 28, 2026 • Product owner: Bala

Build an open-source desktop app that completes browser and file work through agents connected to supported existing subscriptions. Start with the manually imported T3 Code v0.1.2 source. Use its built-in browser for agent work.

[Step one belongs to Bala](https://github.com/B-a-1-a/browser-agent/issues/1). Contributors start only after Bala completes the foundation checks and releases the dependency gate in the implementation issues. Source import and the current repository baseline check do not establish application readiness.

## Users and problem

Serve business and administrative users, personal productivity users, and students. Users describe an outcome, supervise exceptions, and receive usable results. They do not need to design an agent workflow.

The [product outline and interactive wireframes](../design/product-outline.html) group the customer pain points into eight themes:

- Repetitive work and lost learning.
- Setup, access, and dependence on tools.
- Barriers that stop agents.
- Reliability and task context.
- Oversight and control.
- Trust and usable results.
- Speed, costs, and usage limits.
- Privacy and security.

The outline also identifies three hypotheses: fragmented provider management, difficulty reusing task profiles, and unnecessary refusals during legitimate work. These remain hypotheses for user validation.

## Product structure

| Concept | Responsibility |
| --- | --- |
| Workspace or project | Groups tasks, reference files, defaults, and task profiles. |
| Task | One requested outcome with a plan, conversation, workers, permissions, and results. |
| Agent session | A provider runtime session used by the lead agent or a worker. |
| Task profile | Reusable instructions, preferences, and references. Contains no browser credentials. |
| Browser profile | Persistent signed-in browser account state. Separate from task context. |
| Browser worker | A delegated unit inside the selected task, with a browser tab and status. |
| Routine | A saved task definition that can run again with new inputs or a schedule. |

Example: Job Applications → Apply to today's open postings → Lead Codex session and delegated browser workers. A saved task profile contains role preferences. A browser profile contains the website sign-ins.

## Scope and sequence

The first product release includes the requirements R1–R11 below. Contributor delivery proceeds in dependency order, with separate service and interface ownership. The Stagehand evaluation is optional research and cannot block the working browser path.

Keep these outside the first release: a general-purpose replacement for the user's everyday browser, cloud execution while the computer is off, mobile product redesign, automatic CAPTCHA solving, built-in VPN/proxies, teaching by demonstration, and automatic model routing. Preserve inherited clients and provider adapters without promising the new desktop workflow on every surface.

### Step one owned by Bala

Validate and stabilize the inherited foundation before product feature work starts. Fix inherited core failures here rather than distributing duplicate rebuild tasks to contributors.

| Foundation | Evidence needed to close step one |
| --- | --- |
| Source and licensing | Verify pinned source provenance, preserved licenses, and the manual import record in UPSTREAM.json. |
| Tooling and desktop startup | Set up the manifest toolchain, install dependencies, build the desktop app, and start it from a clean checkout. Record exact successful commands and known limits. |
| App identity and isolated data | Configure app name, identifiers, data directories, packaging, deep links, and updater defaults. Configure or disable inherited remote, sign-in, and telemetry integrations deliberately. Use separate development data before runtime tests. No new install can update from upstream T3 or open live T3 user data. |
| Provider connections | Exercise Codex sign-in, disconnect/reconnect, model discovery, streaming, interruption, resume, usage-limit behavior, and errors. Prove authentication works with our independent app identity, using supported CLI login where appropriate. Record supported provider capabilities. Preserve other inherited adapters. |
| Durable sessions and orchestration | Exercise task/session creation, durable history, delegation, worker completion, failure propagation, queued work, cancellation, restart recovery, and scheduled execution. |
| Built-in browser | Exercise persistent profiles, sign-ins, tab lifecycle, Playwright/CDP control, ownership transfer, human takeover/resume, screenshots, recording, uploads, and downloads. Record supported cookie import behavior. |
| Files and artifacts | Exercise permitted file reads/writes, attachments, saved outputs, checkpoints, recovery, and any Git-dependent assumptions. General work must have a supported path without requiring a Git repository. |
| Access and transport | Exercise inherited authentication, protected commands, environment isolation, and local connections. Record limits for remote access and non-desktop clients. Establish the permission boundary for new browser/file tools. |
| Tests and automation | Add useful application checks on available runners. Adapt the baseline check's workflow allowlist when enabling CI. Keep upstream signing/deployment workflows archived unless deliberately configured. |
| Team handoff | Record supported operating systems, startup instructions, service interfaces, representative fixtures, and known limitations. Review imported AGENTS.md and CONTRIBUTING.md for upstream-specific assumptions. |

Close the owner issue only when these checks have evidence and no unresolved core blocker remains. Bala chooses the initial release operating systems and confirms the provider/permission boundary during this step. Contributor issues remain blocked until closure and an explicit handoff from Bala.

## Functional requirements

### R1 Connect tools and create browser profiles

Users connect Codex through its supported subscription connection, select available models, and see connection health. Other providers appear only when their adapter supports the required capabilities.

Users create, rename, select, and remove built-in browser profiles. They sign into websites inside the app. Supported cookie import is optional and must explain when another sign-in is required. Removing a profile requires a clear confirmation because it removes stored account state.

Users can grant folder access. A disconnected provider or unavailable folder produces a recovery action and preserves unfinished task state. Credentials stay in the existing protected credential/profile storage and never enter task profiles, logs, or exports.

### R2 Organize tasks and reusable context

Users create workspaces, save task profiles, add references, and view recent results and active tasks. Include starter task profiles for administration, personal work, and study.

Users start from a request or a task profile, attach files/pages, choose a lead agent and available model, select browser profiles, and choose an output folder. A task stores a versioned snapshot of its instructions and permissions. Later profile changes do not silently change an active task.

Task context stays separate across workspaces and tasks. Browser workers that share a browser profile also share account state. The interface explains this before concurrent account work.

### R3 Plan and delegate work

The lead agent proposes an editable plan, checkable completion criteria, and browser workers. Users can add/remove workers, change supported agents/models, set a concurrency limit, and choose stopping conditions.

Reuse inherited orchestration and provider sessions. Persist worker assignments and results. Each worker receives only its task context, approved references, and browser/file capabilities. Coordinate conflicting writes to shared accounts. Cancelled or failed workers cannot silently continue actions.

Maintain one task conversation for instructions and updates. Worker activity remains inspectable without requiring users to manage separate conversations.

### R4 Show work and support takeover

The task screen contains the shared conversation and a grid of browser workers. Tiles show current activity, status, and browser preview. Clicking a tile opens the worker's built-in tab and activity.

Users can pause, resume, stop a worker, stop a task, or stop all work. They can take control for login, two-factor authentication, CAPTCHA, or a site error. Agent browser input stops while the user owns the tab. Resume uses the current page and checks the next action again.

Stop all cancels active children, queued execution, pending effects, and pending approvals. Future routine schedules remain separate and can be paused explicitly. Deleting a task or workspace retires its pending work. An in-use browser profile cannot be removed until its workers stop.

### R5 Enforce permissions and review actions

Provide Ask, Auto within rules, and Custom permission modes. Review before external submission is the default. Workspace defaults can be narrowed or explicitly changed for a task.

Enforce grants at the app/runtime action boundary, including browser and file tools. Model instructions alone cannot enforce permissions. If a provider exposes an unmediated action path, disable that capability or require human execution until the boundary is enforceable.

Review shows the action, destination/account, content, attachments, and affected files where relevant. Batch approvals cover an explicit selected set. Bind approvals to the exact action payload, destination, browser profile/account, tab ownership generation, and current target state. Changes, expiry, or revocation require another review. Account switches, navigation, and takeover invalidate approval or require revalidation. Re-check grants immediately before execution and prevent duplicate dispatch after reconnect.

Keep webpage content separate from user instructions. Page text cannot grant permissions or expand a task's access. Sensitive actions include sending, submitting, purchasing, deleting, and overwriting outside an existing grant.

### R6 Recover work and explain blockers

Persist task history, plan versions, worker state, approvals, and evidence using the inherited durable model. After restart, show what completed, what needs attention, and what can resume.

Do not repeat a potentially completed external action without checking its outcome. When the outcome is unknown, mark it unknown and request review. Show provider limits, connection failures, authentication barriers, and site restrictions as distinct blockers with recovery actions.

### R7 Deliver results with evidence

Provide a separate Results view with completed, blocked, failed, skipped, and unknown outcomes. Support partial completion. Each completed external action links to confirmation evidence or an explicit verification record.

Users can inspect source links, screenshots, submitted fields, generated files, and action history. A success statement from an agent is insufficient evidence. Evidence can be unavailable, but the interface must not claim a verified completion in that case.

Users can open or export useful files, tables, and digests. Exports omit credentials and sensitive account storage. Do not upload local files to an extra service without a supported user-selected connection.

### R8 Reuse tasks and receive useful notifications

Users can save a task as a routine, change inputs, run it again, and schedule it. Reuse inherited schedules and queues. Users can pause, edit, and delete routines.

Scheduled runs inherit explicit permissions and must pause for required approval. The app and computer must be running for local execution. Show missed runs and let users choose whether to run them. Do not execute a backlog silently after sleep.

Notify users about required action, completion, failure, and meaningful changes. Avoid repeated unchanged alerts. The Needs you inbox links directly to the affected task, approval, or browser worker.

### R9 Explain usage and limit execution

Show duration and provider-reported usage when available. Label estimates and unavailable measurements. Do not present subscription use as a measured currency charge.

Users can set concurrency, supported usage budgets, and stopping conditions. Pause or queue new work when limits are reached. A budget without reliable provider measurements must state its limitations and use enforceable limits such as worker count or elapsed time.

### R10 Keep the desktop experience usable

Support keyboard navigation, visible focus, readable text, and meaningful status labels. Status cannot rely on color alone. Show loading, empty, error, and disconnected states.

Keep browser previews bounded and avoid continuous unnecessary repainting. Use the inherited communication contracts and services so desktop wrappers and shared clients remain compatible. Record unsupported capabilities explicitly.

### R11 Preserve portability and user control

Keep provider and browser-control adapters replaceable. Export/import reusable instructions and routine definitions without browser credentials. Version exports and report unsupported fields.

Use the inherited Playwright/CDP browser path initially. Evaluate Stagehand through the same browser-control boundary before adoption. Its performance and subscription compatibility require measurement in this app. Do not make Stagehand or a second model service a required dependency by assumption.

## Task states and ownership

Use explicit states: draft, planning, awaiting plan approval, queued, running, needs you, paused, completed, partially completed, failed, and cancelled. Define legal transitions in contracts and test recovery paths. Workers have their own execution states and one browser owner at a time.

Keep task identifiers, worker/session identifiers, browser-profile bindings, plan versions, grants, pending actions, and result evidence linked. UI state derives from persisted service state. The orchestrator decides transitions, adapters perform side effects, and transports call services.

## Typical journey

1. Connect Codex, create a browser profile, sign into job portals, and choose a folder for results.
2. Create Job Applications and save a resume and role preferences in a task profile.
3. Ask the app to find today's matching jobs and prepare applications.
4. Review the plan and workers with submission approval enabled.
5. Workers search, compare roles, and prepare applications inside the task.
6. Take over a blocked portal, sign in, and return control.
7. Review the selected applications and approve their exact submissions.
8. Inspect confirmations, generated files, and unfinished items in Results.
9. Save a weekday routine that keeps the same approval requirement.

## Acceptance and measurement

The primary measure is verified task completion: tasks whose requested outcome is confirmed, divided by all attempted tasks. Report partial, failed, blocked, and unknown outcomes separately. Track completion time, user interventions, repeat-use rate, and measured provider usage alongside it.

Count each task run once, including its retries. Report user cancellations separately and exclude them from the completion-rate denominator. A monitoring run with no changes counts as successful only when it proves that the agreed checks ran.

Bala records a baseline during step one and sets pilot targets before launch. No local efficiency advantage for Stagehand is assumed. Use representative administration, personal productivity, and study tasks with controlled fixtures before live pilots.

Release acceptance requires:

- The supported desktop build starts from a clean checkout with documented commands.
- Profile persistence and task context isolation work across restart.
- Delegated workers respect concurrency, cancellation, and browser ownership.
- Altered or revoked approvals cannot execute, including after reconnect or restart.
- Permission checks cover every exposed browser/file action path for the supported provider.
- Interrupted submissions recover without silent duplicate execution or false success.
- Results distinguish verified, partial, failed, blocked, and unknown outcomes.
- Routines pause for approval, disclose local execution limits, and handle sleep/missed runs.
- Keyboard users can complete the main journey and intervention flows.
- Changed logic has focused behavior tests. Visual changes have appropriate captures and a manual interaction check. CI covers the supported build and affected checks.

## Implementation ownership

The [GitHub delivery tracker](https://github.com/B-a-1-a/browser-agent/issues/19) links the execution checklist. Each issue specifies its own service or interface boundary, dependencies, exclusions, and test evidence. Contract changes land before dependent service and UI implementations. Mock fixtures can support parallel UI work after the owner gate opens.

Keep product requirements here and active progress in issues. Do not recreate inherited provider, browser, scheduling, or orchestration engines as separate contributor projects. Step one proves those foundations and subsequent issues adapt them to this product.

## References

- [Product outline and interactive wireframes](../design/product-outline.html)
- [Import provenance](../../UPSTREAM.json)
- [T3 Code v0.1.2 source release](https://github.com/pingdotgg/t3code/releases/tag/v0.1.2)
- [Research and customer needs](https://github.com/B-a-1-a/agentic-ai-browser-agent-r-d)
