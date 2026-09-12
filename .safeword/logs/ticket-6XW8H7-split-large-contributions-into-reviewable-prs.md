# Work Log: split-large-contributions-into-reviewable-prs (6XW8H7)

## 2026-09-12 implementation planning

- Parent reconciliation is current and the independently approved scenario
  packet remains authoritative.
- Figure-it-out compared fixed size thresholds, one large sectioned pull
  request, and dependency-ordered conceptual slices. Chose conceptual slices:
  each has one purpose, explicit prerequisites, its own proof, and a safe
  supported post-merge state. Line and file counts remain warning signals only.
- Current evidence: Google's Small CL guidance defines smallness as one
  self-contained change with related tests and a working post-submit system;
  GitHub's stacked-pull-request guidance orders foundational dependencies below
  their consumers and supports independent review and bottom-up merging.
- Premortem: a slice appears independent but hides a runtime dependency on a
  later slice. Mitigate in the contract by requiring prerequisites, proof, and
  supported intermediate state for every slice rather than adding a size
  heuristic.
- Independent plan review `1972f10f-293a-4b2f-8aab-1b314aef689f` requested one
  blocking correction: deterministic fixtures cannot prove that a real model
  applies the conceptual-scope rule. The plan now requires a matched-pair live
  smoke through the CLI boundary and fails that smoke when the load-bearing
  clause is removed. It also names the undecided-design proof case, the
  authoring template's build step, `K3EBHB`'s NTB recovery ownership, and
  `5F5ZZA`'s review-currency ownership.
- Corrected review `349f3536-7ea6-4824-9825-91ff23515672` found the proof table
  still left R2, R3, and R5 open to scripted semantic outcomes. The plan now
  requires per-Rule clause-deletion mutations plus one live positive/defect
  matrix covering all R1–R5 categories, binds proof to each RED/GREEN slice,
  and records the narrow review-coordinator architecture extension.
- Review `9e2e1303-e4b9-4b03-b3a1-a5e0f32ee44a` correctly distinguished verdict
  proof from record-content proof. The plan now uses two live positive plans and
  a defect matrix with field-omission and unresolved-design as separate cases;
  it inspects the positive eligibility, obligation-owner, unchanged-decision,
  and per-slice proof record. The live lane is opt-in operationally but mandatory
  for this child's completion. A fresh `ticket reconcile-parent 6XW8H7` check
  returned healthy, so the historical digest note does not represent current
  parent drift.
- Review `3b3be37c-d37d-4957-a829-ddbbc88e0127` found the remaining positive
  dependency-order proof gap. Added a schema-before-reader live positive record,
  required exact missing-field and obligation names, assigned exhaustive
  examples to deterministic fixtures and representative application to live
  review, and qualified every mutation check as contract-presence proof only.
- Review `d922e688-e007-422f-9fe8-d1abbf1f189f` found two omitted live
  assertions: the two-purpose denial and the unsafe merge's missing prerequisite.
  Added both, moved a minimal cohesion probe ahead of exhaustive fixture work,
  bound mandatory live provenance and fixture digests to `verify.md`, clarified
  `5F5ZZA` versus `G1C9PP` invalidation ownership, made byte/digest comparison
  explicit, and recorded why only representative omission permutations spend
  live-review tokens.
- The branch-built `ticket approve-plan` gate rejected prose-only Design
  alignment evidence even after semantic approval. Replaced every proof cell
  with resolvable Markdown links and moved the `K3EBHB` delegation out of the
  conflict column, preserving the same design while making its trace
  machine-verifiable.
- Exact-byte review `8603d9b3-a164-4590-9420-0688865f3d07` independently
  approved the final Implementation Plan through the branch-built review
  boundary. The canonical helper records the approval as an explicit bootstrap
  skip because installed Safeword 0.83.1 cannot authenticate branch-added
  review target metadata without trusting the code under review.
- Entered implementation with a second explicit bootstrap skip for Execution
  Planning. This ticket creates the first canonical Execution Plan contract and
  `plan-execution` review kind, so later epic tickets must use the shipped gate;
  this ticket cannot use a gate that does not exist yet.
