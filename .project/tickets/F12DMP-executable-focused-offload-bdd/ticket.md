---
id: F12DMP
slug: executable-focused-offload-bdd
type: feature
phase: intake
status: in_progress
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
