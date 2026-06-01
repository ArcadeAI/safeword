---
id: 0AWSY8
slug: bdd-phase-one-merge
title: 'Epic: Absorb arcade Phase 1 — scenario rules, adversarial review, codify, /review-spec'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-one-merge
paired_with: ZPN3Z9
created: 2026-05-24T21:27:52.411Z
last_modified: 2026-05-24T21:30:00.000Z
---

# Epic: Absorb arcade Phase 1 — scenario rules, adversarial review, codify, /review-spec

**Type:** Feature (epic — design + shipping plan)

**Goal:** Absorb arcade's scenario-authoring and adversarial-review discipline into safeword's `bdd` Phases 3-4, plus arcade's `/codify-spec` test-emission as an optional safeword skill, plus extract Phase 4 into a re-invokable `/review-spec` skill. Specifically: explicit scenario-construction rules (singular Then, outcome-oriented, no-or, readability), the vacuous-pass test, negative-case-coverage, assertion-strength coaching, determinism-risk specifics, structured findings format, cross-cutting review categories, test-stub emission, and standalone review skill.

**Why:** Phase 3-4 in safeword's `bdd` today is built on judgment-driven scenario authoring (dimensions → partitions → scenarios) plus an AODI quality gate that's strong on the four pillars (Atomic/Observable/Deterministic/Independent) but weaker on patterns like vacuous-pass and negative-case coverage. Arcade's pipeline runs the opposite trade — strong scenario-quality coverage via `/review-spec`'s 10-point checklist, plus emits actual executable test stubs via `/codify-spec`, but lacks the dimensions/partitions discipline. The merged phase keeps safeword's coverage-method rigor and adds arcade's specific scenario-quality checks plus the test-emission rung.

**Sourced from:** Comparative analysis in arcade-monorepo session 2026-05-24, after re-reading both safeword `bdd/SCENARIOS.md` (Phases 3-4) and arcade's `build-spec` Phase 3 + `review-spec` (whole skill) + `codify-spec` (whole skill).

**Sibling to:** DZ2NM5 (Phase 0 merge). These two epics can ship independently — Phase 0 covers intake-framing (personas, JTBD, AC), Phase 1 covers scenario authoring + review + test emission. Some children here reference Phase 0 outputs (e.g., scenario numbering threads through), but neither epic blocks the other.

## Tickets

| ID         | Title                                                                                                 | Arcade Pair | Status | Depends On                     |
| ---------- | ----------------------------------------------------------------------------------------------------- | ----------- | ------ | ------------------------------ |
| **XN5SPN** | Explicit scenario-construction rules in Phase 3 (singular Then, outcome-oriented, no-or, readability) | —           | Open   | —                              |
| **9FSPM8** | Vacuous-pass test as Phase 4 scenario quality check                                                   | JWM8PD      | Open   | —                              |
| **XBY5QR** | Negative-case-coverage as explicit Phase 4 rule                                                       | JWM8PD      | Open   | —                              |
| **73CKG4** | Assertion-strength coaching + determinism-risk specifics in Phase 4                                   | JWM8PD      | Open   | —                              |
| **R09T59** | Structured findings format + cross-cutting review categories                                          | JWM8PD      | Open   | —                              |
| **F2QZB4** | Extract Phase 4 into standalone /review-spec skill                                                    | JWM8PD      | Open   | 9FSPM8, XBY5QR, 73CKG4, R09T59 |
| **CS86B0** | Codify-spec absorption: emit .feature + step_def stubs                                                | JN39KG      | Open   | —                              |

**Paired arcade epic:** [ZPN3Z9](../../../../../arcade-monorepo/.claude/worktrees/elastic-noether-5c76a3/.safeword-project/tickets/ZPN3Z9/ticket.md) — arcade-side decommission of `/review-spec` and `/codify-spec`.

**Pairing note:** Many-to-one — five safeword tickets (9FSPM8, XBY5QR, 73CKG4, R09T59, F2QZB4) all pair to the single arcade decommission ticket JWM8PD, since arcade has one `/review-spec` skill that decommissions atomically once safeword absorbs all its checks. Same for CS86B0 ↔ JN39KG (one `/codify-spec` decommission, one safeword absorption). This is a deliberate divergence from DZ2NM5's 1:1 pattern — appropriate because the arcade side has fewer skill files than the safeword side has changes.

## Sequencing

1. **XN5SPN** (scenario rules) — independent; can ship anytime.
2. **9FSPM8, XBY5QR, 73CKG4, R09T59** in parallel — independent Phase 4 enhancements.
3. **F2QZB4** (extract /review-spec skill) — depends on the four Phase 4 enhancement children, since the skill should embody the upgraded Phase 4 checks.
4. **CS86B0** (codify absorption) — independent of the review work; can ship anytime.
5. **Arcade-side decommission** (JWM8PD) — blocked on F2QZB4 (since by then all review checks have landed).
6. **Arcade-side decommission** (JN39KG) — blocked on CS86B0.

## Decisions required before execution

1. **codify-spec — keep as separate optional skill, or fold into decomposition (Phase 5)?** Driver leans separate skill — projects that want front-loaded failing tests invoke it; pure-interleaved-TDD projects skip it. **Open.**

2. **`/review-spec` skill — inline only (Phase 4 fires it), standalone only (no Phase 4 auto-fire), or both (Phase 4 invokes the skill; skill is also reinvokable)?** Driver leans both. **Open.**

3. **Findings format — change safeword Phase 4 output to match arcade's structured format strictly (h4 per finding, Current/explanation/Proposed, 3-tier severity, lead-with-tally, bulk template)?** Driver leans yes. **Open.**

4. **Storage shape** — inherits from DZ2NM5 decision #2 (ticket.md vs spec.md). Resolves with that epic.

5. **Sizing-classifier interaction** — does the new heavier Phase 4 fire for tasks too, or features only? Driver leans features only (the 10-point checklist is heavy; tasks rely on AODI inline). **Open.**

## Out of scope (this epic)

- Phase 0 product-layer absorption (DZ2NM5 — separate epic).
- Phase 5 (decomposition) changes.
- Phase 6 (TDD) changes — the R/G/R checkbox model stays.
- `/implement-spec` and `/build-signals` — Phase 2+ work, separate future epics.
- Numbering scheme — XT1FFM in DZ2NM5 already covers this (scenarios inherit the persona/JTBD/AC numbering from Phase 0).

## Done when

- `bdd` Phase 3 (SCENARIOS.md) includes explicit scenario-construction rules with examples.
- `bdd` Phase 4 (scenario-gate) includes the vacuous-pass test, negative-case-coverage, assertion-strength coaching, and determinism-risk specifics — each as a named check.
- `bdd` Phase 4 output uses the structured findings format (h4, Current/Proposed, 3-tier severity, tally, bulk template).
- `/review-spec` exists as a re-invokable skill embodying the upgraded Phase 4 checks.
- `/codify-spec` (or equivalent) exists as an optional skill that emits .feature + step_def stubs.
- All 7 child tickets are `done`.
- Worked example in SCENARIOS.md exercises all the new checks against a sample scenario set.

## Related

- **DZ2NM5** (Phase 0 merge) — sibling epic. Scenario numbering, persona references, AC structure flow from Phase 0 into Phase 1.
- **MBGQ89** (ticket-deps schema) — standalone safeword improvement that landed first; pairing/blocking fields used here.

## Work Log

- 2026-05-24T21:27:52.411Z Started: Created ticket 0AWSY8
- 2026-05-24T21:30:00.000Z Drafted: Epic shell with 7 children, sequencing, 5 open decisions, many-to-one pairing rationale
