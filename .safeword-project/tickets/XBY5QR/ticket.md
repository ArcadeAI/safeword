---
id: XBY5QR
slug: negative-case-coverage
title: 'Add negative-case-coverage as explicit Phase 4 rule'
type: task
phase: verify
status: in_progress
epic: bdd-phase-one-merge
paired_with: JWM8PD
created: 2026-05-24T21:27:52.550Z
last_modified: 2026-05-24T21:30:00.000Z
---

# Add negative-case-coverage as explicit Phase 4 rule

**Goal:** Add a named Phase 4 rule that pairs each happy-path scenario with a rejection-path counterpart, and surfaces missing rejections as findings.

**Why:** Today, safeword's dimensions/partitions discipline gets at rejection coverage indirectly (a partition can be "invalid input" or "rejected operation"), but doesn't surface it as an explicit check. Result: scenario sets that test happy paths thoroughly and silently miss the error paths. Arcade's `/review-spec` rule 9 makes this a per-scenario check during review.

**Parent epic:** 0AWSY8
**Paired with:** JWM8PD in arcade
**Depends on:** —

## Scope

- Update `bdd/SCENARIOS.md` Phase 4 to add "Negative-case coverage" as a named check: for each happy-path scenario, is there a rejection-path counterpart?
- Coaching: often the negative case is covered implicitly by another scenario; if not, it is a gap.
- Examples of common pairs: create+create-duplicate, read+read-not-found, update+update-not-allowed, action+action-precondition-failed.
- Finding format: "Happy path X has no rejection counterpart. Propose: Scenario Y covering rejection path Z."

## Out of scope

- Auto-suggesting specific rejection scenarios — agent surfaces the gap, user decides what rejection to add.
- Making rejection scenarios mandatory at authoring time (Phase 3) — they emerge from Phase 4 review.

## Done when

- Phase 4 doc has a "Negative-case coverage" check with the per-happy-path question + common-pair examples + finding format.
- Worked example shows a gap caught and a rejection scenario proposed.

## Open questions

- Should this be a hard "must fix" finding or "should strengthen"? Arcade treats it as should-strengthen. Driver agrees — sometimes the rejection is covered by a sibling AC's scenario; forcing one-per-happy-path produces noise.

## Replan — 2026-06-06

Validated: **partial overlap** — safeword's dimensions/partitions already generate rejection cases and the adversarial pass surfaces gaps; arcade's value is _naming_ the happy↔rejection pairing. Reframe as a named lens on the existing adversarial pass, not a new standalone section. "Phase 4" = the `scenario-gate` section of the current SCENARIOS.md. Open question resolved: **should-strengthen**, not must-fix (sibling-AC scenarios often cover the rejection; forcing 1:1 = noise). Point variation at Scenario Outline. Build deferred.

## Work Log

- 2026-05-24T21:27:52.550Z Started: Created ticket XBY5QR
- 2026-05-24T21:30:00.000Z Drafted: Scope, examples, open question; linked to epic 0AWSY8
- 2026-06-06T17:40:00.000Z Replan: reframed as named lens on existing adversarial pass (partial overlap, not new section); severity resolved → should-strengthen. Build deferred.
- 2026-06-06T18:52:00.000Z Implemented: folded a negative-case-coverage lens into the Adversarial pass of bdd SCENARIOS.md (template + dogfood) — per-happy-path question, common pairs (create↔duplicate, read↔not-found, update↔not-allowed, act↔precondition-failed), should-strengthen severity, Scenario Outline pointer; grounded in equivalence partitioning (invalid classes). Kept as a lens, not a standalone section — no duplication of the Define-Behavior partitions discipline, no collision with R09T59's future cross-cutting categories. Verified: parity 120 pairs + 3 contracts, markdownlint 0. Re-sized feature→task. Formal /verify + /audit close gate pending.
