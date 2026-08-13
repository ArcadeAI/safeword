---
id: F12DMP
slug: executable-focused-offload-bdd
type: feature
phase: done
status: done
phase_anchors:
  - done: .project/tickets/F12DMP-executable-focused-offload-bdd/verify.md
phase_skips:
  - define-behavior: The committed spec and issue define the two Rule contracts, scope, outcomes, and source-backed design constraints.
  - scenario-gate: The original independent coordinator timed out; the completed scenarios were subsequently covered by full diff quality review, public-CLI proof, real-Cucumber proof, and exact RGR provenance in test-definitions.md.
  - plan-implementation: The implementation was delivered in two behavior slices followed by two leaf refactors, as recorded in test-definitions.md and the commit history.
  - implement: The work log and verification record identify the completed implementation, review findings, refactors, and executable evidence.
  - verify: The committed verify.md records full-suite, acceptance-lane, public-CLI, generated-artifact, audit, and review evidence gathered before completion.
scope:
  - Enforce an explicit contract between offload Rule delivery tags and the executable Cucumber lane.
  - Replace bundled conjunction steps in the offload corpus with atomic observable steps.
  - Classify fixture and mutation-matrix completeness scenarios as intended Vitest proofs without claiming they already exist.
out_of_scope:
  - Implementing GitHub dispatch, correlation, resume, workflow installation, or any offload product Rule.
  - Removing @wip or claiming the offload scenarios as executable coverage.
done_when:
  - Public Gherkin lint fails when an offload Rule loses @wip without entering the executable proof lane.
  - Harness-completeness scenarios carry @proof.pending-vitest and remain outside completed-proof claims.
  - A guard fails when new offload scenario steps exceed the reviewed readability policy.
  - All offload product Rules remain explicitly @wip.
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-12T05:34:49.609Z
last_modified: 2026-08-12T05:34:49.609Z
external_issue: https://github.com/ArcadeAI/safeword/issues/2624
---

# Turn offload specifications into trustworthy executable coverage

**Goal:** Make offload BDD coverage honest, readable, and incrementally executable.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-12T05:34:49.609Z Started: Created ticket F12DMP
- 2026-08-12T05:39:00.000Z Scoped: Retained all sixteen product Rules as explicit work in progress; this ticket delivers the honest graduation contract and corpus-quality improvements.
- 2026-08-12T06:32:00.000Z Verified: Full Vitest found that @proof.vitest would falsely claim completed proof for six offload features; reclassified the eight meta-proof scenarios as @proof.pending-vitest.
- 2026-08-12T06:52:00.000Z Verified: 47 focused tests, 488 full-suite files (7541 passed, 5 skipped), 1522 BDD scenarios (1519 passed, 3 skipped), lint, typecheck, Gherkin lint, dependency audit, generated-plugin contract, and diff whitespace checks pass.
- 2026-08-12T06:53:00.000Z Review blocked: The prescribed independent scenario-review coordinator timed out twice without returning a typed verdict, so this ticket remains in progress and the pull request stays draft.
- 2026-08-12T17:20:00.000Z Quality review: Replaced the hard-coded offload-id matcher with caller-owned proof policy; made delivery state Rule-scoped; rejected misplaced lineage/proof tags; added public-CLI and real-Cucumber selector proofs; and hardened empty Examples and unreadable explicit inputs.
- 2026-08-12T17:24:00.000Z Refactored: Isolated Rule delivery evaluation and moved diagnostic naming into the caller-owned policy without changing behavior. Focused tests passed after each commit.
- 2026-08-12T17:53:00.000Z Verified: 167 retro-relay tests passed (1 intentional skip); the full CLI suite passed 7,550 tests (5 skips) with one unrelated workspace-glob fixture failure that immediately passed 6/6 in isolation; all 1,519 executable Cucumber scenarios passed (3 skips); build, lint, typecheck, dependency audit, generated-plugin contract, and diff checks passed.
- 2026-08-12T17:54:00.000Z Audited: Diff-scoped architecture, config drift, domain references, documentation impact, and six changed test surfaces are clean. Quality review approved with degraded independence after the preferred reviewer timed out.
- 2026-08-12T20:27:18.000Z Rebased: Merged current main, regenerated the Claude plugin runtime and sealed inventory from source, and confirmed the complete CLI contract remains consistent across registration, handlers, aliases, help, capabilities, fixtures, terminology, documentation, and generated artifacts.
- 2026-08-12T20:27:18.000Z Reverified: 170 retro-relay tests passed (1 intentional skip); 7,594 CLI tests passed (5 skips) with one loaded-suite review-probe timeout that passed immediately in isolation; all 1,519 executable Cucumber scenarios passed (3 skips); build, lint, typecheck, dependency audit, generated-plugin contract, and diff checks passed.
- 2026-08-13T01:03:00.000Z Completed provenance: Added the missing RGR ledger from the original RED/GREEN/refactor commits, merged current main including the package-test isolation fix, and revalidated the CLI contract, generated plugin, lint, typecheck, build, dependency rules, formatting, and dependency audit.
