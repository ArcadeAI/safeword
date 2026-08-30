---
id: 2C1E82
slug: self-contained-agent-plugins
type: epic
subtype: bug-investigated
phase: verify
status: in_progress
children: ['V2AH4B', 'KDED4X', 'SF0RS0', 'GJB22B', 'JNZ2H5', '1DZ9W8']
phase_anchors:
  - 'define-behavior: .project/tickets/2C1E82-self-contained-agent-plugins/spec.md'
  - 'scenario-gate: packages/cli/features/self-contained-agent-plugins.feature'
  - 'plan-implementation: .project/tickets/2C1E82-self-contained-agent-plugins/impl-plan.md'
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
last_modified: 2026-08-30T21:30:00.000Z
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

## Process Gaps Found

- **Fixed here — divergent BDD entry points:** repository-root `test:bdd` composed Cucumber and Vitest-proof provenance, while `packages/cli test:bdd` ran only Cucumber and excluded proof-backed features. Both entry points now compose the same two proof classes, with a contract test preventing drift.
- **Fixed here — proof registration was implicit:** all 32 epic scenarios now have an adjacent manifest mapping them to exact, normally collected executable Vitest declarations; release-only, skipped, focused, missing, duplicated, or under-enumerated proofs fail the normal lane.
- **Fixed here — late fixture inventory:** selected-agent behavior changed the meaning of default install fixtures, but implementation tested only new authority paths. The full fixture and Gherkin inventories were reconciled so every legacy scenario names an explicit host selection where that is its real precondition.
- **Still a Safeword follow-up — phase boundaries validate ledger bookkeeping, not executable routing:** the boundary engine cannot generically prove arbitrary host BDD conventions. The authoritative BDD lane is therefore the independent observation; the remaining process improvement is to bind a successful lane receipt to implement exit rather than trusting workflow guidance until verify/done.
- **Still a Safeword follow-up — generated architecture reconciliation has no supported acknowledgement command:** healing marks all surviving prose stale, the guide forbids editing machine-owned stamps, and `architecture --check` does not reject already-rendered stale markers. This branch followed repository precedent by reviewing the prose and mechanically reconciling stamps, but the product needs one explicit reconcile operation.

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
