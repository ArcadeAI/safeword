---
id: 2C1E82
slug: self-contained-agent-plugins
type: epic
subtype: bug-investigated
phase: implement
status: in_progress
children: ['V2AH4B', 'KDED4X', 'SF0RS0', 'GJB22B', 'JNZ2H5', '1DZ9W8']
phase_anchors:
  - 'define-behavior: .project/tickets/2C1E82-self-contained-agent-plugins/spec.md'
  - 'scenario-gate: packages/cli/features/self-contained-agent-plugins.feature'
  - 'plan-implementation: .project/tickets/2C1E82-self-contained-agent-plugins/impl-plan.md'
  - 'verify: .project/tickets/2C1E82-self-contained-agent-plugins/verify.md'
  - 'done: .project/tickets/2C1E82-self-contained-agent-plugins/verify.md'
scope:
  - Give every supported agent one complete runtime authority while retaining project-authored knowledge and lazy runtime state.
  - Bound reconciliation to the selected agents and explicitly declared shared substrate.
  - Cover Codex, Claude Code, OpenCode, Cursor, every mixed selection, and legacy migration behavior.
out_of_scope:
  - Inventing a Cursor profile-plugin mechanism unsupported by the host.
  - Inventing missing authored knowledge or changing plugin trust and restart semantics.
  - Installing unrelated application tooling merely to execute a plugin workflow.
done_when:
  - Every supported agent workflow executes from its declared authority without borrowing another host's runtime.
  - Missing framework state and precise ignore rules initialize lazily without installation.
  - Single-agent and mixed-agent plans contain only declared selected-host requirements.
  - Release coverage rejects undeclared project-local executable references from native plugins.
created: 2026-08-18T16:58:37.428Z
last_modified: 2026-09-02T20:12:01.000Z
---

# Make each agent's plugin fully self-contained

**Goal:** Neither Claude nor Codex should depend on project-local .safeword/hooks, .safeword/skills, or .safeword/scripts once selected without the other — each plugin package ships and runs its own copies

**Why:** Claude has already packaged guides/scripts/hooks into the plugin bundle but a few wiring gaps (dispatch.js env var, unconditional install schema) still leave stale project-local .safeword content around with no auto-upgrade path; Codex still shells out to project-local .safeword/hooks and .safeword/scripts directly from its skills, unlike its already-self-contained lifecycle hooks (bunx --bun safeword@version)

## Root Cause

The epic advanced from implementation to verification without an executable route for its feature source. Safeword's ledger validation proved only that RED/GREEN/REFACTOR annotations were syntactically valid and reachable; it did not prove that each Gherkin scenario was registered in either the Cucumber lane or the repository's `@proof.vitest` manifest lane. The implementation workflow described that requirement, but no phase-transition boundary enforced it, so the first hard failure arrived in the final full verification run as 32 undefined scenarios.

Confirmed by the acceptance runner reporting every scenario in `self-contained-agent-plugins.feature` as undefined, followed by the proof-manifest oracle rejecting release-only Codex tests and excessive shared-test fan-in. The existing boundary engine's `ledgerChecks` validates ledger presence, annotations, and SHAs but never reads the feature source or its executable proof registration. The repository-root `test:bdd` did run the proof oracle, but the commonly used `packages/cli` entry point excluded `@proof.vitest` features without invoking that oracle, creating a second false-green path.

Ruled out:

- Missing behavioral tests: focused Vitest and release-contract tests existed and passed; the gap was their registration and normal-lane eligibility, not the absence of all assertions.
- A Cucumber discovery/configuration defect: other feature step files are discovered and run by the same configured lane; only this unregistered feature was undefined.
- An independent-review failure: the scenario and quality reviews correctly assessed their bounded behavior/design/code packets, but executable-lane registration was outside those packets and gates.

A later Node 24 acceptance run exposed a second fixture root cause: the bare-CLI
scenario expected Codex repair to outrank project drift but left every default
agent selected and inherited the runner's real `PATH`. Its first action therefore
depended on whether a `claude` executable happened to exist. The same Node 22
runtime passed with Claude on `PATH` and failed with the exact CI result when it
was removed, ruling out Node-version behavior and accumulated suite load. The
scenario now supplies an explicit current Claude profile fixture, preserving the
bare command's default multi-agent behavior while making Codex repair the first
native action by construction.

## Process Gaps Found

- **Fixed here — divergent BDD entry points:** repository-root `test:bdd` composed Cucumber and Vitest-proof provenance, while `packages/cli test:bdd` ran only Cucumber and excluded proof-backed features. Both entry points now compose the same two proof classes, with a contract test preventing drift.
- **Fixed here — host-dependent acceptance state:** the bare-CLI fixture isolated profile directories but not host executables, so its result depended on the runner's installed tools. It now declares Claude's payload and activation state explicitly while retaining the real default-agent route.
- **Fixed here — release proof budget below measured work:** the generated Claude release checker took 14–16 seconds after the final `main` integration, but its Vitest wrapper allowed only 15 seconds. The proof remains single-attempt and bounded, with a 30-second budget that covers the measured check instead of misclassifying valid output as a contract failure.
- **Fixed here — proof registration was implicit:** all 34 epic scenarios now have an adjacent manifest mapping them to exact, normally collected executable Vitest declarations; release-only, skipped, focused, missing, duplicated, or under-enumerated proofs fail the normal lane.
- **Fixed here — proof registration could still be non-discriminating:** the manifest previously accepted static catalogue declarations and adjacent lifecycle checks for behavior that claimed real actor-facing execution. The affected scenarios now run installed/generated Cursor, Codex, Claude, and OpenCode entry points; outline fixtures alter the runtime on disk; and lifecycle apply tests preserve the selected authorities and authored content they name.
- **Fixed here — direct helper paths skipped lazy ignore creation:** `project record-skill-invocation` added the precise ignore rule, but generated Claude and Cursor workflows invoked `record-skill-invocation.ts` directly and created `skill-invocations.log` without it. The canonical helper now owns ignore-before-state ordering, and the CLI command delegates to that same implementation for all hosts.
- **Fixed here — packaged audit lookup assumed a `dist/` directory:** the bundled command resolved templates correctly from the npm CLI but walked above a plugin installed under `runtime/`, making the generated Codex audit command report a missing packaged helper. Package-root resolution now recognizes both layouts and a real versioned plugin-cache fixture executes the sourced-shell contract.
- **Fixed here — native profile uninstall reused the project-core removal schema:** uninstalling Codex while an installed Cursor authority remained could remove `.safeword/SAFEWORD.md` and other shared project substrate. The lifecycle now produces a profile-only project plan in that state, with apply-level proof that Cursor, enrollment, authored knowledge, and unrelated content remain byte-identical.
- **Fixed here — late fixture inventory:** selected-agent behavior changed the meaning of default install fixtures, but implementation tested only new authority paths. The full fixture and Gherkin inventories were reconciled so every legacy scenario names an explicit host selection where that is its real precondition.
- **Fixed here — shared fixtures silently selected no runtime:** lifecycle helpers appended `--agents none` even when their callers exercised project-installed runtime. The helpers now select Cursor explicitly, while native-plugin tests invoke the packaged authority they actually claim to prove.
- **Fixed here — enrollment fixtures used a placeholder instead of the contract marker:** hook tests treated `.safeword/.gitkeep` as enrollment even though lazy runtime state is permitted only when `.safeword/SAFEWORD.md` exists. Fixtures now establish real enrollment, preserving the no-install lazy-state boundary.
- **Fixed here — host smoke tests borrowed another authority:** the Codex verify smoke executed a project helper and Claude simulation executed legacy project settings. Both now resolve and execute their native packaged surfaces from a foreign working directory.
- **Fixed here — stale assertions overclaimed the ADR contract:** root BDD and a unit test required the planning skill to mention a particular template even though the supported behavior is the configured, date-prefixed record destination. The tests now assert that public contract; the immutable-origin fixture correctly prevented an accidental product-text workaround.
- **Fixed here — strict Python checking had no generated-control boundary:** raw experiment control outputs collided as top-level modules while maintained experiment runners had untyped edges. Mypy now excludes only the generated control arm, and the maintained Python sources pass strict checking without behavioral changes.
- **Fixed here — principle identity was coupled to heading decoration:** the audit called configured principles “missing” when an implementation plan omitted only their numeric heading prefix. Source headings and plan traces now share one normalization rule, with unit and Gherkin regression coverage.
- **Fixed here — current-ticket audit leaked across the backlog:** the principle checker scanned every `in_progress` ticket, while the current-work resolver treated completed child-ticket changes as competitors to their active epic. Audit now resolves one current ticket first, and the resolver selects the sole active candidate while remaining fail-closed for multiple active candidates.
- **Fixed here — generated Go experiment output escaped its local ignore file:** the checker directory ignored `checkbin`, but a normal Go build emits `checker`. The exact generated binary name is now ignored, so verification no longer dirties the worktree.
- **Fixed here — generated Claude release checks trusted a self-consistent stale bundle:** the release contract verified the generated plugin's internal inventory seals but did not compare that bundle with the canonical templates and runtime sources. Release validation now runs the generator in check mode, so a stale generated bundle fails even when its own hashes agree.
- **Fixed here — Claude bundle generation inherited the caller's test environment:** `Bun.build` folded the ambient `NODE_ENV` into generated runtime bytes, so generation under Vitest differed from generation in a normal release shell and could preserve test-only seams. Generation now defines one deterministic development environment, and BDD proves release validation is independent of the caller's environment.
- **Fixed here — catalogue regeneration did not cascade to downstream release artifacts:** refreshing the historical Claude catalogue changed the canonical runtime without refreshing the committed plugin bundle or lifecycle-origin fixture results. The generated plugin and supported origin/main fixture baselines were regenerated, and release plus lifecycle contracts now reject either stale layer.
- **Fixed here — documentation audit exposed a split authority claim:** one legacy README paragraph still said Claude used project-local hook adapters. The paragraph now matches the shipped authority partition: Claude, Codex, and OpenCode execute packaged hooks; Cursor owns the selected project-local adapters.
- **Still a Safeword follow-up — phase boundaries validate ledger bookkeeping, not executable routing:** the boundary engine cannot generically prove arbitrary host BDD conventions. The authoritative BDD lane is therefore the independent observation; the remaining process improvement is to bind a successful lane receipt to implement exit rather than trusting workflow guidance until verify/done.
- **Still a Safeword follow-up — verification repeats the CLI suite through root and package plans:** the exact verifier ran the root aggregate and then the CLI package suite again, and likewise ran root and package BDD entry points. The duplicate BDD entry point is useful contract coverage after this fix, but the repeated test corpus makes authoritative verification materially slower; test-plan composition needs a deduplicated execution model without losing entry-point parity proof.
- **Still a Safeword follow-up — generated architecture reconciliation has no supported acknowledgement command:** healing marks all surviving prose stale, the guide forbids editing machine-owned stamps, and `architecture --check` does not reject already-rendered stale markers. This branch followed repository precedent by reviewing the prose and mechanically reconciling stamps, but the product needs one explicit reconcile operation.
- **Still a tooling follow-up — the system skill validator has an undeclared dependency:** its validation script imports PyYAML, which is unavailable in the workspace dependency set. Verification did not install packages to compensate; the validator must declare or vendor its runtime dependency.

## Work Log

- 2026-08-18T16:58:37.428Z Started: Created ticket 2C1E82
- 2026-08-30T01:00:00.000Z BDD intake resumed after a Codex PR-review session exposed the missing product boundary: plugin skills still required project-local executables, and `--agents=codex` proposed the full cross-host project payload. Added the intake brief and persona-specific JTBDs before changing implementation.
- 2026-08-30T01:10:00.000Z Rules amendment: confirmed that missing framework-owned runtime state must be initialized lazily by the invoking workflow, never through an installation process; authored knowledge and project configuration remain outside automatic state creation.
- 2026-08-30T01:12:00.000Z Rules amendment: lazy initialization also owns transient-state hygiene by adding the exact required gitignore rule idempotently and preserving existing ignore content.
- 2026-08-30T01:15:00.000Z Engineering scope drafted: native plugin runtime becomes self-contained; project enrollment, authored knowledge, and lazy state remain; agent selection becomes the reconciliation boundary; Cursor and safe legacy migration remain covered.
- 2026-08-30T01:18:00.000Z Intake confirmed; advanced to define-behavior with the accepted spec as the phase anchor.
- 2026-08-30T01:25:00.000Z Scenario feedback expanded the contract from Codex/Claude plugins to every supported agent: Codex, Claude Code, OpenCode, and Cursor each get one complete declared runtime authority, with selection isolation across all combinations.
- 2026-08-30T01:35:00.000Z Define-behavior complete: saved the dimension matrix, executable feature source, and R/G/R ledger; user confirmed the all-agent scenario boundary and advanced it to independent review.
- 2026-08-30T04:00:00.000Z Scenario review requested changes: closed three blocking vacuous/lineage gaps and strengthened recovery, surface, enrollment, version, ignore, persona, and partition coverage before re-review.
- 2026-08-30T05:18:00.000Z Scenario gate approved by an independent Claude Opus review after proving per-host runtime authority, lazy state and ignore hygiene, selection-scoped reconciliation, and safe migration boundaries. Advanced to implementation planning.
- 2026-08-30T05:40:00.000Z Implementation plan approved by an independent Claude Opus review after tightening Cursor/OpenCode authority proof, failure containment, legacy precedence, ignore ordering, principles alignment, and child-ticket reconciliation. Advanced to outside-in implementation.
- 2026-08-30T17:23:00.000Z Implementation complete: native Codex, Claude Code, and OpenCode workflows now execute from packaged authorities; Cursor retains its complete project authority; selected-agent reconciliation omits unselected runtimes; missing transient state and precise ignore rules initialize lazily after enrollment. Focused implementation and release-contract lanes passed, and the final independent Claude Opus quality review approved the delivery after its blocking findings were resolved. Advanced to verification.
- Verification exposed an invalid implement exit: the feature had no executable Cucumber or Vitest-proof registration, and the full suite retained assumptions from unconditional project runtime. Returned to implementation after documenting the process root cause and ruled-out alternatives.
- 2026-08-30T21:30:00.000Z Closed the executable-route gap: bound every epic scenario to the normal Vitest lane, made the package-local BDD command run both Cucumber and proof provenance like the repository-root lane, reconciled selected-agent legacy fixtures, regenerated versioned plugin artifacts after merging current main, and reconciled the implementation plan against shipped runtime authority.
- 2026-08-30T21:50:00.000Z Implement exit passed: the corrected package-local BDD entry point ran 587/587 Cucumber scenarios (10,954/10,954 steps) and 38/38 proof-provenance tests; advanced to authoritative verification.
- 2026-08-30T22:35:00.000Z Verification fixture reconciliation complete: project-runtime helpers now declare Cursor authority, native Claude/Codex smokes execute packaged surfaces, enrolled hook fixtures use the real marker, reset and conditional-setup expectations follow selected authority, the test-runner lock recognizes commands rather than tag prose, and the maintained Python experiment sources pass strict mypy with generated controls explicitly excluded. Focused regressions passed, including 174/174 corrected BDD scenarios, 75/75 affected tests, and the final 19/19 smoke/contract checks.
- 2026-08-30T23:05:00.000Z Audit feedback closed three more process defects instead of suppressing them: principle numbers are no longer part of identity, the audit resolves only the current ticket, completed child lineage no longer makes an active epic ambiguous, and the Go experiment binary is ignored under the name the tool actually emits. Added Gherkin and normally collected Vitest proofs; 131 focused tests and both new behavior scenarios passed.
- 2026-08-31T01:30:00.000Z Final verification and release-contract repair complete: both full test-suite passes, both BDD entry points, build, typecheck, and dependency scans passed on `4260bfcfd`. Release validation now compares generated Claude output with canonical sources under a deterministic environment; supported lifecycle fixtures were refreshed after the resulting plugin identity change. The diff audit passed with explicit Python experiment coverage limitations and corrected one stale README authority claim.
- 2026-08-31T01:35:00.000Z Done: recorded exact-head verification, four-agent surface evidence, the clean diff audit, known evidence limits, and the remaining Safeword process follow-ups in `verify.md`.
- 2026-09-02T19:43:11.000Z Reopened at implementation after the post-completion BDD/TDD quality audit found non-discriminating proof mappings, outline examples that did not alter their fixtures, one out-of-scope scenario, and stale rebased ledger evidence. The repair is limited to real entry-point proof, truthful scenario wording, and durable lineage.
- 2026-09-02T20:12:01.000Z GREEN after replacing false proof mappings with real generated/installed workflow execution. The new boundaries exposed and fixed three product gaps: direct helper ignore creation, Codex plugin runtime package-root resolution, and profile-only uninstall preservation while Cursor remains. Focused proof, workflow, lifecycle, identity, and schema coverage passed 103/103 tests.
- 2026-09-02T20:38:14.000Z Independent scenario re-review approved the repaired feature and identified five non-blocking proof-strength opportunities. Reopened RED to add the empty-diff shell boundary, split mixed enrollment outcomes, make OpenCode authority externally discriminating, align profile lifecycle ownership with the builder persona, and record the non-Git observability boundary explicitly.
- 2026-09-02T20:41:23.000Z GREEN on the scenario-review strengthening pass: the new real-shell empty-diff proof and the complete 34-scenario manifest passed 43/43 focused tests; Gherkin lint, exact feature-to-ledger matching, and reachable TDD lineage also passed.
- 2026-09-02T20:46:24.000Z Second scenario review requested one blocking lineage correction and six discriminators. Added the missing NTB1.R2 spec Rule, narrowed SWM1.R1 to release authority, bound all host rows to generated entry points in an enrolled Git repository, paired missing-authored-content rejection with positive state creation, made the OpenCode hook result caller-visible, tagged profile lifecycle with both affected surfaces, documented proof-bound legacy cleanup ownership, and added the empty-diff shell proof note. Content-bound spec self-review passed after explicit ticket disambiguation.
