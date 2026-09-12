# Impl Plan: Point-of-need Safeword enrollment

**Status:** planned
**Planned on:** 2026-09-12

## Approach

The riskiest assumption is that every shipped state-access route can reach one shared decision before touching a Safeword-owned path without flattening host-native approval semantics. The cheapest proving scenario is **Every state-access mechanism asks before project state is accessed**: an installed-artifact integration test can inject each route, observe the filesystem independently, and fail before real-host E2E cost is introduced.

Use the component contract in `design.md`: a pure marker-only decision core, a distribution-derived route catalogue and owned-path classifier, a coordinator over the existing lifecycle plan/apply path, and thin native host adapters. Keep choice and continuation state in the initiating operation; persist neither decline nor resume tokens. The existing content-addressed lifecycle plan remains the only mutation authority.

### Proof plan

| Scenario group | Primary proof | Supporting and wiring proof |
| --- | --- | --- |
| R1 — supported surfaces, access mechanisms, quiet load, lifecycle exemptions, marker semantics | Integration through generated/installed Claude, Codex, OpenCode, Cursor, and CLI artifacts under an external Node preload observer installed before any Safeword module loads; it records filesystem opens/stats/reads/writes and fails unless quiet load has zero owned-path accesses or first state need reads only the enrollment marker. The observer exercises the complete discovered distribution, not only catalogue examples. | Unit tables for route/target classification; real CLI process; rejection fixtures for unguarded and uncatalogued routes; before/after snapshots independently prove write confinement |
| R2 — bounded plan, effect confinement, explicit consent, namespace/customer preservation, OpenCode scope | Integration against the real lifecycle planner/installer in isolated repositories; positive builder acceptance and agent-output rejection traverse each installed Claude, Codex, OpenCode, and Cursor artifact plus the real Safeword CLI process | Unit tests for input-provenance classification and no-input/abandoned choice; repository, profile, and home-root snapshots prove decline writes no dismissal state |
| R3 — BDD stop, optional review continuation, prompt cadence, accepted resume | Cucumber integration for BDD and quality-review plus the scripted real-Claude `@demo`; installed-artifact tests send two state needs with one host operation envelope and fail if a second prompt appears | Unit operation-envelope tests prove one choice per operation and a later operation can ask again |
| R4 — drift, partial install, cancellation, unmet setup, duplicate/handoff resume | Integration around real plan identities and injected lifecycle ports; for Claude, Cursor, and Codex, the installed-artifact harness starts a fresh hook process after the first proven resume, delivers a second resume trigger with the same host operation envelope, and requires zero second executions | Unit state-machine tests for consume-once continuation, failed handoff, and prerequisite recheck |
| R5 — enrolled/namespace/proof regressions and missing state | The same installed Claude, Codex, OpenCode, and Cursor artifacts and real CLI process used for R1 run against enrolled repositories and assert no setup prompt | Differential namespace fixtures and invocation-proof gate regression tests |

Every new public or host entry point gets a wiring test that starts outside the decision core. The read observer is a runtime-preload boundary, not Safeword instrumentation. Following the repository's existing effect-witness pattern, the harness prepends temporary `node` and `bun` wrapper executables to `PATH`: the Node wrapper executes the real runtime with `--import <observer>`, and the Bun wrapper executes the real runtime with `--preload <observer>`. Direct CLI leaves are launched through the matching wrapper; installed hook commands and the real Claude host inherit the wrapper `PATH`. Every observed child must emit a preload-bootstrap handshake before its artifact output is accepted, so an absolute runtime path or stripped environment fails the test instead of looking quiet. A sensitivity fixture deliberately reads a forbidden owned path through each Node and Bun wrapper and must make the assertion fail before quiet-load or marker-only results are trusted.

The observer wraps filesystem entry points before importing the installed artifact and emits an out-of-process trace consumed by the harness. Quiet-load fixtures reject the marker read itself; first-state-need fixtures permit exactly that read and reject config, namespace, ticket, proof, migration, or other owned-path reads before the prompt event. The real-Claude demo uses the inherited wrapper/preload trace plus before/after snapshots, a pinned scripted driver, and waits on filesystem/host events, never elapsed time. Each installed agent artifact must prove a real builder-originated acceptance reaches plan/apply/resume; an adapter that always stops fails this test. OpenCode additionally reuses the exact-version 1.18.23 real-process conformance harness for its first-state-need path. Cursor uses hooks schema v1; no Cursor profile installer is added.

Operation-local state has an explicit non-Safeword carrier. CLI and the long-lived OpenCode plugin hold it in process memory. Claude and Cursor reconstruct it from a stable session/conversation identity and the host-owned transcript/event context already supplied to their hooks. Codex carries it in the current thread/turn workflow context and correlates hook input through the existing run-identity resolver. No repository, profile, home, or Safeword cache file records a decline or resume token. Installed-artifact tests invoke fresh hook processes twice with one host operation envelope and require one prompt, then use a new envelope and require a new prompt. After an accepted operation resumes, the same harness starts another fresh Claude, Cursor, or Codex hook process, replays the same resume trigger, and requires no second initiating-operation execution. A host event without both stable identity and current interaction context fails closed for required state with a manual retry.

### Build order

1. **Load-bearing boundary:** add Node/Bun runtime wrappers, the external preload filesystem observer, bootstrap-handshake enforcement, and deliberate-read sensitivity fixtures; then add failing Cucumber steps and installed-artifact/unit tables for zero-access quiet load, marker-only first state need, schema-owned targets, full-distribution route completeness, exactly-one prompt across fresh hook processes, non-interactive and abandoned choices, and repository/profile/home-root non-persistence.
2. Add the pure enrollment decision/catalogue modules and typed CLI result shapes; update declarative CLI protocol-catalog prompt/effect/network policies for newly enrollment-capable non-lifecycle project commands, including `--json --no-input`; keep explicit lifecycle commands and enrolled paths unchanged.
3. Add plan/apply coordination over the existing lifecycle planner and installer, including plan identity validation, bounded effects on partial failure, prerequisite recheck, concurrency, and consume-once continuation; extend the fresh-process installed-artifact harness to reject a second resume execution on Claude, Cursor, and Codex before host wiring proceeds.
4. Wire required BDD and optional quality-review state needs, replacing unenrolled invocation-log jargon with the shared choice/stop/stateless outcomes.
5. Wire Claude plugin dispatch, Codex packaged hook, OpenCode profile plugin, Cursor installed hooks, and direct CLI prompting; add positive builder-consent and agent-output-rejection tests through every installed agent artifact and the real CLI process, plus a shared forbidden-terminology assertion over every emitted prompt, stop, recovery, and stateless-review message. Reuse OpenCode's pinned 1.18.23 real-process conformance lane for first-state-need dispatch.
6. Add distribution catalogue/parity rejection tests, regenerate Claude/Codex/OpenCode/managed template artifacts through existing generators, and run schema/release parity checks. Exercise the independent observer across the complete discovered distribution and measure classification latency against the existing five-second common-operation hook budget.
7. Supersede in part the accepted **Explicit Project Enrollment for Profile-Scoped Codex Hooks** record in `ARCHITECTURE.md`: preserve fail-open behavior for unrelated work and the ban on pre-enrollment writes, while allowing marker-only classification and a stop/setup choice immediately before a Safeword-owned path would be accessed. Keep its original rationale and add this ticket and reassessment trigger.
8. Update README and website workflow/CLI references, then run the scripted real-Claude Killer Demo and full verification.

## Decisions

### Implementation Inspiration

| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://code.claude.com/docs/en/hooks-guide | 2026-09-12 | Current docs; Claude Code 2.1.268 installed | Claude Code 2.1.268 | PreToolUse runs before permission checks and supports allow, deny, ask, and non-interactive defer | Stop at the real tool boundary and let the host own builder interaction | Claude output shape is host-specific; documentation is evidence, not reusable code |
| https://cursor.com/docs/hooks | 2026-09-12 | Hooks schema v1 | Hooks schema v1 | preToolUse covers Read, Write, Shell, and MCP tools; its common input supplies `conversation_id`, `generation_id`, `transcript_path`, and `workspace_roots`; blocking hooks can fail closed and return user/agent messages | Classify the proposed operation before filesystem access and reconstruct the operation envelope from host-owned conversation/transcript identity | Cursor project hooks do not create a new global distribution; cloud read-only turns may not run hooks |
| https://dev.opencode.ai/docs/plugins/ | 2026-09-12 | V1 docs current 2026-09-11 | OpenCode 1.18.23 pinned by project | Profile plugins expose tool.execute.before plus permission asked/replied events | Keep profile delivery and adapt native events to the shared decision | V1/V2 APIs differ; target only the already-supported V1 contract and add no dependency |
| https://github.com/openai/codex/blob/main/docs/config.md | 2026-09-12 | Codex main docs; local 0.153.4 | Codex 0.153.4 | Codex has lifecycle hooks and its app server owns explicit approval RPCs | Keep hook classification separate from host-owned approval | Main can move; pin behavioral tests to the installed 0.153.4 executable and do not copy source |

**Decision impact:** changed: external evidence rejected a universal hook output and retained a shared policy core with host-native adapters; local architecture then confirmed the existing integration registry is the reuse seam.
**Decision informed:** Centralize enrollment policy and plan/apply semantics; keep event translation and consent presentation in native host adapters.

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Centralize enrollment policy and plan/apply semantics; keep event translation and consent presentation in native host adapters. | Pure shared decision/coordinator modules behind the existing integration registry | Hook-only implementation; generated skill prose only | Hooks cannot share one approval/resume protocol across hosts; prose cannot prevent agent-authored path access. Sources: https://code.claude.com/docs/en/hooks-guide, https://cursor.com/docs/hooks, https://dev.opencode.ai/docs/plugins/, https://github.com/openai/codex/blob/main/docs/config.md |
| Reuse the canonical lifecycle planner and content-addressed plan identity for enrollment. | Add an enrollment-specific coordinator that previews, obtains explicit approval, applies, and rechecks the existing install plan | Directly create required files; make all explicit installs newly confirm-policy | Ad-hoc writes violate reconciliation and customer preservation; changing ordinary explicit install semantics expands scope and breaks existing behavior. |
| Keep prompt dismissal and continuation ephemeral. | One host-owned operation envelope and consume-once continuation: process memory for CLI/OpenCode, transcript/event context for Claude/Cursor, thread/turn context for Codex; no Safeword-owned dismissal record | Repository token; profile/home-directory cache; unit-only in-memory model with no hook rehydration | Pre-consent writes violate the contract; an external cache can suppress future operations; a unit-only carrier cannot prevent repeated prompts across fresh hook processes. |
| Prove route coverage with catalogue parity plus independent filesystem observation. | Static distribution discovery plus an external preload read/write trace and dynamic installed-artifact/real-process tests; explicitly catalogue prompt-time legacy migration, proof/activation writers, and every other lifecycle writer | Safeword's own access log; snapshots alone; per-workflow hand inspection | Self-instrumentation misses bypasses; snapshots cannot observe reads; manual inventory cannot reject an uncatalogued route in CI. |

No new dependency is selected. Node/Bun standard-library readline and existing lifecycle modules are sufficient.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Default output is one plain-language choice and next action; explicit install/status/doctor/plan/uninstall and typed evidence remain available | `packages/cli/features/quiet-unenrolled-reviews.feature` R1–R3 plus CLI JSON contract tests | |
| 1. Structure enforces; instructions suggest | Pre-tool adapters stop owned-path access; plan identity and prerequisite checks gate mutation/resume; prose only routes the workflow | R1 parity rejection scenarios, R2 disclosed-effect scenarios, R4 prerequisite scenarios | |
| 2. Fire at boundaries, not every turn | Marker classification runs only at a declared first state need or a tool targeting a Safeword-owned path; surface load stays quiet | R1 quiet-load and exactly-one scenarios | |
| 3. Add, never replace | Existing lifecycle reconciliation owns all installation effects and preserves customer paths/custom namespaces | R2 customer preservation, plan confinement, and namespace scenarios | |
| 4. Contribute, then converge | The builder receives a concrete bounded canonical plan before approval rather than an abstract setup question | R2 bounded-plan-before-approval and exact-plan-application scenarios | |
| 5. Correct and safe; then clear; then simple | One pure policy core, no new dependency, native adapters only where contracts differ | Unit decision tables, adapter wiring tests, full schema/parity verification | |

Architecture decisions honored: **Registry-Driven Agent Integrations with Native Trust Boundaries**, **Project-Default Claude Plugin Declarations and Project-Bound Proof**, and **Restart-Bound Codex Plugin Activation** in `ARCHITECTURE.md`. The design extends their registries and packaged dispatchers; it does not replace host authority or activation proof. The accepted **Explicit Project Enrollment for Profile-Scoped Codex Hooks** record is superseded in part in place: unrelated pre-enrollment work still fails open and no project state is written, but marker-only classification may run and stop immediately before a Safeword-owned path access. Build step 7 preserves its original rationale and records the replacement and reassessment trigger. No separate ADR file is planned because the architecture log is updated in place as its evolution rule requires. `design.md` owns the feature-specific component interaction.

## Known deviations

- Cursor remains project-delivered as the accepted architecture specifies, so the feature guards installed Cursor routes but does not invent a profile plugin.
- OpenCode Desktop remains advisory because native plugin dispatch is not yet proven; the enforced scope is the supported CLI/TUI 1.x path and the pinned 1.18.23 real-process conformance lane.
- Codex Desktop code-mode may omit its documented PreToolUse bridge. The packaged workflow still asks before its own declared state need, but hook interception cannot claim coverage for a host event Codex does not dispatch; the existing run-identity fallback does not fabricate that event.

## Doc impact

- `README.md`: replace unenrolled fallback examples with the point-of-need setup choice and explicit decline behavior.
- `packages/website/src/content/docs`: update workflow/CLI guidance for first state need, bounded plan approval, stateless continuation, and host-specific limitations.
- Generated skill and plugin copies are distribution artifacts, not standalone documentation; update canonical templates and regenerate them in build order step 6.

## Assessment triggers

- A supported host cannot expose the proposed target before executing a read/write, so its adapter cannot enforce the boundary.
- A host cannot distinguish a builder input event from agent-generated output; that surface must stop rather than infer consent.
- The existing lifecycle plan cannot be reapplied by identity without effects outside the preview.
- Requirement recheck needs durable resume state or writes anything before consent.
- Route discovery cannot reject an uncatalogued generated workflow or schema-owned path consumer.
- Pre-tool classification exceeds the project's five-second common-operation hook budget.
- OpenCode V2 replaces the pinned V1 tool/permission event contract, or Cursor gains a supported profile distribution that changes its authority boundary.
