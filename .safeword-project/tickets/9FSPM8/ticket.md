---
id: 9FSPM8
slug: vacuous-pass-test
title: 'Add vacuous-pass test as Phase 4 scenario quality check'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-one-merge
paired_with: JWM8PD
created: 2026-05-24T21:27:52.501Z
last_modified: 2026-05-24T21:30:00.000Z
---

# Add vacuous-pass test as Phase 4 scenario quality check

**Goal:** Add the vacuous-pass test as a named Phase 4 check — "Mentally remove the feature implementation. Could this scenario still pass?" Catches scenarios that test the test setup, where the Given pre-populates state that the Then trivially asserts.

**Why:** The single sharpest scenario-quality check anywhere — catches the "Given a database row with X exists; Then a database read returns X" anti-pattern that AODI doesn't flag. Without it, scenarios silently pass without exercising the feature.

**Parent epic:** 0AWSY8
**Paired with:** JWM8PD in arcade (decommission of /review-spec)
**Depends on:** —

## Scope

- Update `bdd/SCENARIOS.md` Phase 4 (scenario-gate) to add "Vacuous-pass test" as the FIRST named check (before AODI), with the procedure:
  1. Mentally remove the feature implementation.
  2. Ask: could this scenario still pass?
  3. If yes → vacuous; flag and propose a stronger Then.
- Document the common vacuous patterns with examples:
  - Then asserts only that a response exists ("a response is returned").
  - Then asserts on internal state that the Given pre-populated.
  - Given puts the system in a state that makes the Then trivially true.
  - Then is a non-claim ("the system remains running").
- Each finding gets a proposed stronger Then.

## Out of scope

- Other Phase 4 enhancements (separate tickets — XBY5QR, 73CKG4, R09T59).
- Hook-enforcement of vacuous-pass — purely an agent-applied check.

## Done when

- Phase 4 doc has a "Vacuous-pass test" section with procedure + 4 common-pattern examples + the "propose stronger Then" expectation.
- Worked example in SCENARIOS.md shows a vacuous scenario caught and rewritten.
- The Phase 4 worked example in DISCOVERY.md (or wherever the merged worked example lives post-DZ2NM5) includes at least one vacuous-pass-caught case.

## Open questions

- Order within Phase 4: vacuous-pass first (since failures here invalidate everything downstream), or after AODI (consistent ordering)? Driver leans first.

## Work Log

- 2026-05-24T21:27:52.501Z Started: Created ticket 9FSPM8
- 2026-05-24T21:30:00.000Z Drafted: Scope, vacuous patterns, open question; linked to epic 0AWSY8
