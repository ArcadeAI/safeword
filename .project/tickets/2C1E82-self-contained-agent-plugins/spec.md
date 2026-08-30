# Spec: Make each agent plugin fully self-contained

## Intake Brief

- **Requested by:** Safeword's product owner after a real Codex PR-review session required interaction with the project installer despite the workflow already shipping in the Codex plugin.
- **Cost of inaction:** Codex and Claude users can be pushed toward a large, surprising project mutation merely to execute a plugin workflow. In a monorepo, that can propose hundreds of files, unrelated host assets, and dependency changes across many workspaces; declining the install leaves nominally available plugin skills partially inoperable.
- **Reversibility:** Two-way door. Delivery and installation filtering can be changed without altering customer data or a public application API, provided upgrades preserve authored project state and mixed-agent installations.

## Jobs To Be Done

### self-contained-plugins.TBU1 — use an agent workflow from its declared delivery authority

**Persona:** Technical Builder (TBU)

> When I invoke a Safeword workflow from a supported agent, I want the workflow to execute from that agent's declared delivery authority, so I can review and ship work without accepting unrelated repository changes or relying on another agent's runtime.

#### self-contained-plugins.TBU1.R1 — every advertised agent workflow executes from its one declared runtime authority without borrowing another delivery

#### self-contained-plugins.TBU1.R2 — invoking an agent workflow never requires a broader installation solely to recover executable code already owned by its delivery authority

#### self-contained-plugins.TBU1.R3 — agent execution reads enrolled project knowledge and writes project workflow state without turning either into a second runtime distribution

#### self-contained-plugins.TBU1.R4 — a workflow creates its missing framework-owned runtime state on demand without requiring an install or upgrade

#### self-contained-plugins.TBU1.R5 — lazy initialization adds any required narrow gitignore rule idempotently while preserving existing project ignore content

### self-contained-plugins.NTB1 — trust that a requested workflow will not expand into unexplained setup

**Persona:** Non-Technical Builder (NTB)

> When I ask my agent to run a Safeword workflow, I want any required setup to stay minimal and plainly connected to that workflow, so I can safely approve the next action without understanding Safeword's internal file layout.

#### self-contained-plugins.NTB1.R1 — selecting one agent never proposes another agent's files, skills, hooks, configuration, or dependencies

#### self-contained-plugins.NTB1.R2 — an installation plan distinguishes the minimal shared project substrate from selected-agent delivery and optional workflow tooling, and explains why each effect is required

#### self-contained-plugins.NTB1.R3 — a single missing plugin capability fails with one bounded recovery action rather than expanding into repository-wide setup

#### self-contained-plugins.NTB1.R4 — automatic state initialization is silent when successful and names the exact state path and recovery when it cannot be created

### self-contained-plugins.SWM1 — preserve host parity without duplicate runtime authorities

**Persona:** Safeword Maintainer (SWM)

> When I change a shared Safeword workflow, I want each native plugin to carry and invoke its own complete runtime while project reconciliation installs only the assets selected hosts truly require, so I can maintain parity without stale or duplicated implementations.

#### self-contained-plugins.SWM1.R1 — each host's delivery contract explicitly classifies executable runtime, shared project substrate, authored state, and host-specific assets

#### self-contained-plugins.SWM1.R2 — selecting multiple agents produces the union of their declared requirements without duplicate runtime authorities or order-dependent output

#### self-contained-plugins.SWM1.R3 — release and parity checks reject any agent workflow that references an executable outside its declared runtime authority

#### self-contained-plugins.SWM1.R4 — upgrades and uninstalls remove only proven host-owned runtime while preserving authored, ambiguous, and other selected-host content

## Product Inspiration

### Visual Studio Code extensions

- **Checked:** 2026-08-29
- **Sources:** [Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy), [Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host)
- **Observed customer value:** An installed extension declares its commands and carries the entry point that implements them. VS Code activates that extension when its command is invoked and runs it in the appropriate extension host; users do not copy the extension implementation into each workspace before using a command.
- **Transferable principle:** A native plugin capability should carry its own executable implementation. The project may supply data, configuration, trust, and authored state, but it should not be a second distribution location for the plugin's runtime.
- **Boundary not to copy:** Safeword still needs explicit repository enrollment and project-authored workflow state; unlike a general editor extension, it must fail open outside enrolled projects and preserve mixed-host project configuration.
- **Decision changed or retained:** Retain project enrollment and authored knowledge, but require Codex and Claude plugin workflows to execute from their version-pinned distributions. Project reconciliation must select host-specific assets instead of treating the common project payload as implicitly required by every plugin.

### Docker Compose profiles

- **Checked:** 2026-08-29
- **Source:** [Using profiles with Compose](https://docs.docker.com/compose/how-tos/profiles/)
- **Observed customer value:** Optional services are activated only when their profile is selected. Explicitly targeting one profiled service starts that service and its declared dependencies, not every service sharing the broader configuration.
- **Transferable principle:** Selection must be transitive but bounded: choosing a host installs that host's declared dependencies, not unrelated hosts or every optional tool in the system.
- **Boundary not to copy:** Safeword is reconciling files, packages, and profile plugins rather than starting containers; dependency declarations must additionally preserve user-authored files and migration state.
- **Decision changed or retained:** Make the selected-agent set an enforceable reconciliation boundary. Shared assets must be explicitly classified as genuinely shared, and host-specific assets must not leak into another host's plan.

## Rave Moment

skip: internal delivery boundary; the highest persona-facing moment belongs to the installed workflow experience rather than this implementation epic.

## Surfaces

- **Affected:** OpenAI Codex
- **Affected:** Claude Code
- **Affected:** OpenCode
- **Affected:** Safeword CLI
- **Affected:** Cursor

## Scope

- Give every supported agent exactly one declared runtime authority and make every advertised workflow executable from that authority.
- Make profile-plugin-backed Codex, native Claude, and OpenCode workflows executable without borrowing project-local or another host's runtime files.
- Keep Cursor's project delivery complete and independently selectable until Cursor exposes a supported profile-plugin boundary; it must not borrow Claude, Codex, or OpenCode runtime assets.
- Give packaged workflows version-pinned executable entry points for all helpers they invoke, including sourced/shared-shell behavior that cannot be replaced by a naive subprocess.
- Make framework-owned runtime state and its parent directories initialize lazily at the workflow boundary.
- Add precise transient-state gitignore rules lazily, idempotently, and without replacing or reformatting customer ignore content.
- Classify reconciliation assets by shared substrate and host ownership, then filter install, plan, upgrade, and uninstall effects from the selected agent set.
- Prove Codex-only, Claude-only, OpenCode-only, Cursor-only, every mixed selection, and legacy-upgrade behavior.
- Add release/parity checks that reject agent skills referencing executables outside their declared runtime authority.
- Reconcile the existing child tickets under this epic against the behavioral scenarios, merging or closing implementation-shaped slices where the shared solution makes them redundant.

## Out of Scope

- Creating a Cursor profile-plugin mechanism that the host does not support; Cursor's declared authority may remain project-local while still obeying selection isolation and self-containment.
- Removing project-authored knowledge, tickets, configuration, or durable verification artifacts.
- Changing Codex plugin trust, activation, restart, or legacy-proof semantics except where required to preserve safe cleanup of obsolete project runtime copies.
- Automatically inventing missing authored knowledge or enrollment configuration.
- Installing or reconfiguring unrelated application development dependencies merely because a native plugin workflow runs.
- Redesigning Safeword's language packs or lint/BDD toolchain beyond making their installation explicitly selected and bounded.

## Done When

- In an enrolled repository, every shipped Codex, Claude Code, OpenCode, and Cursor workflow executes from its declared authority or reports a capability-specific bounded failure; none borrows another agent's runtime or directs the user to run a broader installation to recover owned code.
- A missing framework-owned state file is created by the invoking workflow, and transient state receives exactly one narrow ignore rule without an install or upgrade command.
- Every single-agent plan contains no other host's assets. Plugin-backed agent plans contain no project-local copies of their executable workflow runtime, while Cursor retains only its declared project-local delivery.
- Every combination of supported agents produces the deterministic union of their declared contracts.
- Existing authored files and ambiguous legacy content survive upgrade/uninstall; recognized obsolete runtime copies are retired only after replacement-plugin proof.
- Static release/parity coverage fails on any agent workflow reference to an executable outside its declared runtime authority.
- Acceptance scenarios reproduce the observed Codex audit/review failure and prove it no longer expands into a monorepo-wide installation plan.

## Open Questions

None at intake exit.

## Confirmed Decisions

- Missing framework-owned runtime state is created lazily by the workflow that needs it. Users do not run install or upgrade to initialize state. This does not authorize silently inventing missing authored knowledge or project configuration.
- When lazily created state is transient, the workflow also adds its precise ignore rule without running installation, duplicating entries, broadening the ignored scope, or replacing existing ignore content.
- Codex, native Claude, and OpenCode use their profile-plugin distributions as their executable runtime authorities. Cursor retains a complete, independently selected project-local authority until the host supports an equivalent plugin boundary. Every agent shares only enrollment, authored knowledge/configuration, and lazily initialized state.
