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
