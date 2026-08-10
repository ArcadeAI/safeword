---
id: EBTNER
slug: reassess-general-bdd-mutation-automation
type: task
phase: intake
status: in_progress
parent: AK0QJR
blocked_on: [7B1AMC, SH5GSP, FY1NHB, RXSGXP]
relates_to: [7ZLTWB, 21RAT9]
external_issue: https://github.com/ArcadeAI/safeword/issues/2341
created: 2026-08-10T07:58:18.186Z
last_modified: 2026-08-10T08:00:27Z
---

# Reassess broader BDD mutation automation from measured evidence

**Goal:** Decide whether any general mutation automation is justified after review, corpus, skill-evaluation, and curated-falsification data exist.

**Why:** A universal semantic mutation gate was rejected as premature because its runner constraints, attestations, false-positive risks, and execution cost outweighed its current incremental value.

## Decision Inputs

- Residual false-green rate after independent RED review and advisory detection.
- Defect classes missed by the curated falsification set.
- False-positive, maintenance, runtime, and token costs observed in cross-agent evaluation.
- Whether a narrow mutation contract can be host- and framework-agnostic with trustworthy cleanup and evidence.

## Out of Scope

- A prior commitment to ship mutation automation.
- Making generated mutations a universal blocking gate.
- Accepting attestations or suite-level green/red status as proof that a scenario detected a defect.

## Done When

- The preceding tickets have produced enough measured evidence for a decision.
- A written decision accepts, narrows, or rejects broader automation with explicit benefits, costs, risks, and alternatives.
- If accepted, implementation is split into separately estimated tickets with rollback and false-positive controls.
- If rejected or deferred, the decision records the evidence threshold that would justify reopening it.

## Work Log

- 2026-08-10T07:58:18.186Z Started: Created ticket EBTNER
- 2026-08-10T08:00:27Z Planned: Made this an evidence-gated decision ticket, not an implementation commitment.
