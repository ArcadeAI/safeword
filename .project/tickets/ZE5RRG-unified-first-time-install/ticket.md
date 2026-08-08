---
id: ZE5RRG
slug: unified-first-time-install
type: feature
subtype: bug-investigated
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/1925
phase_anchors:
  - 'define-behavior: .project/tickets/ZE5RRG-unified-first-time-install/spec.md'
  - 'scenario-gate: packages/cli/features/unified-first-time-install.feature'
  - 'implement: .project/tickets/ZE5RRG-unified-first-time-install/impl-plan.md'
scope:
  - establish one documented canonical command model for installation, health, planning, diagnostics, and removal while preserving all existing aliases as compatibility routes outside the canonical quick path
  - add `safeword install` as the beginner-facing command that reconciles core project configuration and, by default, installs the Claude and Codex profile plugins
  - support one shared `--agents=<comma-separated agents>` selector on lifecycle commands; `claude`, `codex`, and `cursor` select integrations, while `none` selects project-only behavior
  - leave Cursor configuration untouched unless `cursor` is explicitly selected; selected Cursor installation reconciles `.cursor/hooks.json`, `.cursor/rules/`, and `.cursor/commands/`
  - make `status` the concise aggregate health command and make `doctor` a genuinely deeper diagnostic command rather than routing both names to the same handler
  - make `plan` preview core and selected-agent effects, including profile, network, destructive, and manual activation consequences
  - add an exact-plan-confirmed `uninstall` inverse for core and selected integrations; retain `remove` as a compatibility alias for its current project-only behavior
  - deprecate `setup`, `claude install`, and `codex install` in favor of canonical `install` forms while retaining them as working compatibility aliases
  - retain every existing command and option alias, including overdue top-level aliases, bare `safeword`, `--remove-legacy-hooks`, `--stage`, and `--staged`; hide aliases where the host supports it, relegate the rest to compatibility documentation, and emit structured compatibility guidance
  - stop silently ignoring `setup --yes`; retain it as an explicit compatibility option that reports its translation or redundancy
  - make global `--json` the sole documented JSON contract while retaining legacy `--format json` behavior as a deprecated compatibility format
  - replace ambiguous architecture option names with orthogonal canonical names for reading from the index and staging output while retaining the old spellings as aliases
  - align lifecycle descriptions and documentation so destructive cleanup, migration, recovery, installation, and uninstallation effects are named accurately
  - publish an exhaustive CLI reference covering every canonical family and command, including `review run` and `codex clean-guidance`, plus a separate compatibility-alias table
  - update help, capabilities, result metadata, quick-start documentation, and tests for the coherent command model
  - plan implementation as independently verifiable lifecycle, compatibility, surface-integration, and documentation slices while retaining one unified ticket
out_of_scope:
  - deleting any command or option alias
  - introducing a separate user-scoped Cursor plugin
  - weakening Claude or Codex plugin activation, trust, cleanup, migration, backup, or recovery guarantees
  - removing specialized migration, cleanup, or recovery operations whose effects are not installation or uninstallation
  - installing or launching the Claude Code, Codex, or Cursor applications themselves
done_when:
  - a new user can run one `safeword install` command to reconcile the project and install the Claude and Codex plugins
  - default installation does not create, update, or remove Cursor configuration
  - `install --agents=claude` configures the core project and installs Claude without installing Codex or changing Cursor
  - `install --agents=codex` configures the core project and installs Codex without installing Claude or changing Cursor
  - `install --agents=none` provides an explicit project-only route, comma-separated selections compose, and `install --agents=cursor` explicitly reconciles Cursor's project-local assets
  - output distinguishes project configuration from Claude and Codex profile installation and gives each required human follow-up
  - rerunning `install` safely converges the core project, Claude, and Codex configuration without duplication
  - `status` and `doctor` have distinct tested contracts, with status concise and doctor exposing deeper diagnostics and coverage
  - `plan` accounts for every effect that the matching install or uninstall selection can produce without performing those effects
  - `uninstall` requires an exact reviewed plan and reverses only recognized Safe Word-owned state for the selected surfaces, preserving custom and third-party content
  - `setup`, agent-specific install commands, `remove`, all existing top-level aliases, and all existing option aliases remain executable and return structured compatibility guidance
  - `setup --yes` is no longer silently ignored
  - global `--json` is the only canonical documented machine-output route; retained raw JSON compatibility is clearly labeled and tested
  - canonical architecture options make input source and output staging unambiguous while old flags retain their exact behavior
  - partial failures identify the failed surface and preserve successful work and existing recovery guarantees
  - capabilities accurately describe canonical commands, conditional effects, aliases, compatibility policy, and executable fixtures
  - the CLI reference lists every canonical command and accurately describes destructive effects and alias behavior
  - each affected surface has a named real-boundary proof using production collaborators and mocking only the external filesystem, network, clock, or subprocess boundary; any native-host proof that cannot run is recorded as `skip:` with the exact limitation
  - verification records an NTB walkthrough that identifies ready, failed, and next-action states without code knowledge, plus a TBU walkthrough that exposes exact evidence, selected scope, and a targeted retry without losing control
  - the implementation plan divides the work into independently testable slices with an objective proof command for each slice
created: 2026-08-04T05:33:38.572Z
last_modified: 2026-08-08T08:25:00.000Z
---

# Give users one coherent Safe Word command model

**Goal:** Give users one predictable CLI vocabulary for installing, inspecting, planning, and removing Safe Word across projects and agent integrations without breaking existing aliases.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Root Cause

The catch-up conflict exists because `main` and this branch independently
changed the same human-result rendering block for two valid contracts. `main`
extracted `resultBodyLines` and made review independence text reuse the
coordinator's cause-specific primary message. This branch added install-surface
outcomes, activation steps, doctor coverage, and diagnostic-cause deduplication
inside the original renderer. Git cannot compose those overlapping edits, even
though the behaviors are complementary.

Confirmed by a fresh `git merge-tree --write-tree` against current `main`: the
only hand-written conflict is `packages/cli/src/cli-protocol/result.ts`; the
other three conflicts are generated plugin runtime/inventory artifacts. The
source diffs and their separate regression tests show that the correct merge
must retain both contracts in the extracted `resultBodyLines` function.

Ruled out:

- Stale GitHub mergeability state: the fresh local merge-tree reproduces the
  conflict against the fetched remote heads.
- Generated plugin metadata as the cause: those files derive from the CLI
  source and will reconcile once the source merge is rebuilt.
- Taking either branch wholesale: `main`'s review-rendering tests require its
  cause-specific message path, while this ticket's result tests and BDD require
  lifecycle surfaces and doctor diagnostics.

### Reviewer process-tree test isolation

The post-merge full suite exposed a reproducible timeout-test failure because
the test prepended its fake `claude` executable to the ambient `PATH` instead of
isolating it. On this workstation the runtime correctly discovered the fake and
two real Claude installations, then divided the one-second test deadline among
all three candidates. That left roughly 333 ms for the fake candidate, which
could expire before its shell created the child-PID evidence file.

Direct instrumentation confirmed the fake was first in the candidate list and
that all `SAFEWORD_REVIEW_*` variables survived environment sanitization. The
failure disappeared when the test exposed only its fake executable and invoked
`/bin/sleep` by absolute path. This preserves the production multi-candidate
budget contract while making the process-tree test independent of tools
installed on the developer or CI host.

Ruled out:

- Environment sanitization: the reviewer environment retained the PID path.
- Broken process-group cleanup: successful isolated runs killed the recorded
  descendant as intended.
- Full-suite contention alone: the unisolated test also failed in a focused
  Vitest process.

## Work Log

- 2026-08-04T05:33:38.572Z Started: Created ticket ZE5RRG
- 2026-08-04T05:34:15.000Z Intake: Unified first-time installation will reconcile project assets (including Cursor), install both native profile plugins (Claude and Codex), and retain `setup` as a deprecated alias to the same flow.
- 2026-08-04T05:36:00.000Z Scope correction: Default installation must leave Cursor untouched; Cursor remains available only through an explicit opt-in installation path.
- 2026-08-04T05:39:00.000Z Selection contract: No flags installs Claude and Codex; combinable `--claude`, `--codex`, and `--cursor` flags narrow the agent integrations to the explicit selection while core project reconciliation always runs.
- 2026-08-04T05:42:00.000Z Interface simplification: Replaced per-agent boolean flags with one `--agents=` selector. `install` is the sole canonical installation route; legacy `setup`, `claude install`, and `codex install` remain only as deprecated compatibility aliases.
- 2026-08-04T05:53:16.000Z CLI audit amendment: Expanded the feature to distinguish status from doctor, make lifecycle planning/removal coherent, clean up no-op and ambiguous options, standardize canonical JSON/docs, and retain every existing command and option alias as a tested compatibility route.
- 2026-08-04T12:06:49.000Z Intake accepted: User's “go” confirmed the amended jobs, rules, and engineering scope. Resolved install failure, offline, uninstall-default, architecture-option, and indefinite-alias policy questions; advanced to define-behavior.
- 2026-08-04T12:18:00.000Z Behavior draft: Kept the CLI cleanup in one feature despite its size because the user explicitly asked to amend the unified ticket with the full audit rather than split it. Added dimensions, Gherkin scenarios, and an R/G/R ledger covering the canonical lifecycle and all retained compatibility routes.
- 2026-08-04T12:43:00.000Z Quality review pass 1: Cross-agent review requested changes. Defined duplicate and exclusive `none` selector behavior, added offline project-only and no-input uninstall coverage, expanded lifecycle plan partitions, and made every alias-to-canonical mapping explicit while preserving specialized operations as first-class commands.
- 2026-08-04T13:02:00.000Z Quality review pass 2: Confirmed existing `remove`/`reset` already use exact-plan confirmation, then made that preserved project-only contract explicit. Added differential fixtures for nontrivial aliases, unattended install, offline Cursor, and named CLI-reference coverage for `review run` and destructive `codex clean-guidance`.
- 2026-08-04T13:16:00.000Z Quality review pass 3: Added the missing `setup --yes` contract, explicit project-only and single-agent uninstall planning partitions, and architecture differential scenarios grounded in the existing staged-tree implementation and integration tests.
- 2026-08-04T13:31:00.000Z Quality review approved: Cross-agent review returned Healthy after the behavior packet closed selector, alias, destructive-plan, `setup --yes`, architecture compatibility, machine-output, and reference-coverage gaps. Gherkin validation is green; awaiting the user's scenario-completeness confirmation before scenario-gate.
- 2026-08-04T13:37:00.000Z Quality improvements adopted: Made real-boundary proof mandatory for CLI, Claude, Codex, and Cursor; added observable NTB/TBU walkthrough scenarios; and required the implementation plan to use independently verifiable slices with one proof command per slice.
- 2026-08-04T13:49:00.000Z Quality review follow-up: Added drifted and partial-install convergence, executed targeted retry, and executed post-cleanup recovery scenarios. Split project-only `none` from the selector outline, grounded `reset` in its current project-only removal mapping, and named the two retained raw-JSON commands.
- 2026-08-04T14:40:06.000Z Tracker adoption: Created GitHub issue #1925 first, then linked this local execution ticket to its canonical external identity.
- 2026-08-04T14:41:00.000Z Define-behavior exit: User confirmed the reviewed behavior packet is complete by directing work to proceed; advanced to scenario-gate with the feature source as its phase anchor.
- 2026-08-04T14:43:00.000Z Scenario-gate exit: Cross-agent review returned Healthy with no changes; wrote the Codex-author/Claude-reviewer cross-agent stamp and found no unresolved build-only kill-risk.
- 2026-08-04T14:44:00.000Z Planning entry: Advanced to plan-implementation to design the typed lifecycle, schema ownership projection, compatibility normalization, and proof slices before RED code.
- 2026-08-04T15:07:00.000Z Plan-implementation exit: `impl-plan.md` and `design.md` validated locally; the prescribed retry produced a Healthy cross-agent plan review with no changes, and the plan-implementation stamp passed.
- 2026-08-04T15:07:30.000Z Implement entry: No design approval gate is configured, so advanced autonomously to outside-in TDD with the unified default-install CLI wiring scenario first.
- 2026-08-05T19:45:00.000Z Verification, audit, and refactor complete: 6,550 Vitest tests passed with 5 intentional skips; 1,007 BDD scenarios passed with 3 intentional skips; build, lint, typecheck, dependency audit, architecture enforcement, and principle trace passed. Applied audit/refactor findings by restoring domain boundaries, centralizing shared lifecycle projections/effects, hardening large-bundle closeout verification, and reconciling architecture prose. The final independent quality-review routes produced no valid verdict after the one prescribed retry, so `verify.md` records that evidence limitation without inferring approval.
- 2026-08-06T21:05:00.000Z Expanded review attempt: Reran the realistic five-file independent quality review twice with `SAFEWORD_REVIEW_TIMEOUT_MS=300000`. Neither run timed out; both preferred Claude routes ended earlier as `process_failed`, and both Codex fallbacks remained `invalid_output`. Updated `verify.md` with the corrected evidence and retained issue #1922 as the review-runtime fix.
- 2026-08-07T01:19:11.000Z In-session review and final verification: With the user's explicit approval, replaced the unavailable external verdict with three fresh-context advisory reviews covering code/architecture, behavior/UX, and tests/regressions. Implemented every requested change, including scoped plan replay, full uninstall, complete status/doctor surfaces, diagnostic doctor output, reference coverage, literal compatibility fixtures, deterministic test isolation, closeout error handling, and narrow dependency security updates. Final evidence: 6,562 Vitest tests and 1,007 Cucumber scenarios passed; lint, typecheck, dependency boundaries, architecture, principle trace, and audit passed. The advisory reviews are recorded as useful evidence, not cross-model approval.
- 2026-08-07T16:06:15.000Z Main catch-up investigation: Reproduced the current merge conflict and traced it to complementary edits in the shared human-result renderer. Recorded the source-level composition required to preserve both review-assurance explanations and lifecycle/doctor output; generated plugin conflicts will be rebuilt from the resolved source.
- 2026-08-07T17:36:16.000Z Main catch-up resolved: Merged current `origin/main`, preserved both renderer contracts, regenerated the Claude plugin bundle, and aligned stale native-Claude and Codex acceptance fixtures with canonical `install --agents=...` behavior while keeping Cursor unselected. Post-merge verification passed 7,189 Vitest tests and 1,323 Cucumber scenarios (55,524 steps), with only the intentional skips; lint, typecheck, dependency, security, architecture, principle-trace, generated-artifact, and website-build gates also passed.
- 2026-08-07T17:38:10.000Z Release-tip catch-up: `main` advanced to the v0.74.2 release while the full BDD lane was running. Merged the release tip, regenerated the Claude plugin identity/inventory at 0.74.2, and passed the Claude plugin release contract plus its six targeted release tests.
- 2026-08-07T20:15:00.000Z Reviewer-runtime test investigation: Traced the post-merge timeout-test failure to ambient real Claude executables sharing the fake candidate's one-second deadline. Isolated the test PATH to its fake executable and kept the descendant workload available via an absolute `/bin/sleep` path; no production timeout or cleanup behavior changed.
- 2026-08-08T07:05:00.000Z Release-tip refactor and final verification: Confirmed the merge preserved both parents, committed a green baseline, then centralized lifecycle result precedence, install-action normalization, project-only uninstall aliases, and supported-agent defaults/help metadata. Regenerated the Claude plugin runtime and completed a clean diff audit. Final local evidence: 7,195 tests pass with 6 intentional skips; 1,323 Cucumber scenarios and 55,524 steps pass with only the known skips; lint, typecheck, Gherkin lint, release contracts, and generated artifacts pass. Dependency boundaries have zero errors and one unchanged external-entry warning.
- 2026-08-08T07:10:00.000Z Current-source security re-review: A same-day registry refresh exposed newly published/updated advisories in transitive DOMPurify 3.4.12 and Nano ID 3.3.16. Added exact root overrides to patched 3.4.13 and 3.3.17, refreshed the lockfile, and restored `bun audit` to zero vulnerabilities. Website typecheck/build, root lint/typecheck, release contracts, release tests, and focused CLI tests pass after the dependency-only fix.
- 2026-08-08T08:25:00.000Z Final lifecycle review and release verification: Resolved every independent in-session review finding by binding plans and uninstall to exact Claude scope, rejecting irrelevant scope, deriving agent effects from production convergence observations, preserving explicit Claude update opt-outs, suppressing stale reload advice, and reporting Cursor removal from observed assets. Canonicalized remaining operative `setup` guidance while retaining all aliases. Both final re-reviews approved. Final evidence: 7,205 unit tests pass with 6 intentional skips; 1,325/1,328 BDD scenarios and 55,607/55,611 steps pass with only intentional skips; lint/typecheck, dependency/security, generated-plugin, 35 release tests, and website typecheck/build pass.
- 2026-08-08T08:30:00.000Z Delivery complete: Marked the fully verified ticket done so the ready PR carries its closure state, satisfying the ready-PR ticket gate before merge.
