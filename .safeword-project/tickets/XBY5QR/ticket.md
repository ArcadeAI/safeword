---
id: XBY5QR
slug: negative-case-coverage
title: 'Add negative-case-coverage as explicit Phase 4 rule'
type: feature
phase: intake
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

## Work Log

- 2026-05-24T21:27:52.550Z Started: Created ticket XBY5QR
- 2026-05-24T21:30:00.000Z Drafted: Scope, examples, open question; linked to epic 0AWSY8
