---
id: 73CKG4
slug: assertion-strength-determinism
title: 'Determinism-risk specifics in the scenario-gate (assertion-strength folded)'
type: feature
phase: done
status: done
epic: bdd-phase-one-merge
paired_with: JWM8PD
created: 2026-05-24T21:27:52.592Z
last_modified: 2026-05-24T21:30:00.000Z
---

# Determinism-risk specifics in the scenario-gate (assertion-strength folded)

**Goal:** Add two Phase 4 enhancements: (1) assertion-strength coaching with weak→strong Then vocabulary, and (2) determinism-risk specifics with named failure patterns (time-dependent, ordering-dependent, concurrency).

**Why:** Safeword's AODI says "Deterministic" but doesn't name the patterns that cause non-determinism in practice; result: scenarios that pass in isolation but flake in CI. Arcade's `/review-spec` rule 8 names the specific patterns. Same for assertion-strength: AODI says "observable" but doesn't show what weak vs strong Then looks like.

**Parent epic:** 0AWSY8
**Paired with:** JWM8PD in arcade
**Depends on:** —

## Scope

### Assertion-strength coaching

- Update Phase 4 to add an "Assertion strength" check with weak→strong examples:
  - Weak: "Then the request succeeds." → Strong: "Then the request returns 200."
  - Weak: "Then the user sees the content." → Strong: "Then the response body contains the user's name."
  - Weak: "Then the User Source is updated." → Strong: "Then a subsequent read returns the new value."
- Coaching: the Then should be specific enough to fail when something is actually broken.

### Determinism-risk specifics

- Extend AODI's "Deterministic" check with named risk patterns:
  - Time-dependent assertions without an explicit wait/polling rule.
  - Unordered list comparisons that depend on iteration order.
  - Concurrent state without specifying ordering guarantees.
- Coaching: each pattern gets a proposed mitigation (explicit wait, sort before compare, document ordering invariant).

## Out of scope

- Vacuous-pass and negative-case checks (separate tickets).
- Findings format for these checks (covered by R09T59).
- Auto-detecting these patterns in scenario text (would require LLM-driven scenario parsing; out of scope).

## Done when

- Phase 4 doc has an "Assertion strength" check with the three weak→strong example pairs and the specificity coaching.
- Phase 4 doc's existing "Deterministic" criterion is expanded with the three named risk patterns + mitigations.
- Worked example shows a weak Then caught and strengthened, and a determinism-risk caught and mitigated.

## Open questions

- Are the three weak→strong examples sufficient, or do we need a longer catalog? Driver leans three is sufficient as a starter; users can pattern-match from there.

## Replan — 2026-06-06

Validated: **partial overlap** — AODI already has **Deterministic**, and `testing/SKILL.md` Iron Law 2 already shows weak→strong assertions. Reframe both as **named specifics layered on existing AODI** (determinism: time-without-wait, unordered iteration, concurrency) plus a pointer to testing Iron Law 2 for assertion strength — not new standalone sections. "Phase 4" = the `scenario-gate` section. Three weak→strong examples sufficient (open question resolved). Build deferred.

## Re-scope — 2026-06-06 (post-quality-review)

Narrowed to **determinism-only**. The assertion-strength half is now redundant: `testing/SKILL.md` Iron Law 2 already shows weak→strong assertions, and the shipped vacuous-pass check (9FSPM8) already coaches "propose a stronger `Then`." So the remaining net-new content is the **determinism triad** (time-without-wait, unordered-iteration, concurrency) layered onto AODI's **Deterministic** pillar; assertion-strength is at most a one-line pointer to Iron Law 2, not a standalone check. Aligns with the 0AWSY8 epic table/Status. Build deferred.

## Work Log

- 2026-05-24T21:27:52.592Z Started: Created ticket 73CKG4
- 2026-05-24T21:30:00.000Z Drafted: Scope (assertion strength + determinism risk), examples; linked to epic 0AWSY8
- 2026-06-06T17:40:00.000Z Replan: reframed as named specifics on existing AODI Deterministic + pointer to testing Iron Law 2 (not new sections); examples count resolved → three. Build deferred.
- 2026-06-06T23:20:00.000Z Re-scoped (post-quality-review): determinism-only; assertion-strength folded (already covered by testing Iron Law 2 + the shipped vacuous-pass check). Title updated; now consistent with the 0AWSY8 epic decision.
- 2026-06-06T23:35:00.000Z Implemented + verified: added "Determinism risks" subsection to the scenario-gate (time-without-wait, order-dependent, unsequenced-concurrency + mitigations), grounded in Luo et al. (2014) + Fowler. Template + dogfood parity 120/120, markdownlint 0. verify.md written; closed.
