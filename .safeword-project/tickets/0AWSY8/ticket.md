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

| ID         | Title                                                                            | Arcade Pair | Status | Depends On     |
| ---------- | -------------------------------------------------------------------------------- | ----------- | ------ | -------------- |
| **XN5SPN** | Scenario-construction rules in Define Behavior (one-behavior/When, declarative…) | —           | Done   | —              |
| **9FSPM8** | Vacuous-pass test in the scenario-gate                                           | JWM8PD      | Done   | —              |
| **XBY5QR** | Negative-case-coverage lens in the adversarial pass                              | JWM8PD      | Done   | —              |
| **73CKG4** | Determinism-risk specifics in the scenario-gate (assertion-strength folded)      | JWM8PD      | Done   | —              |
| **R09T59** | Structured findings format + cross-cutting review categories                     | JWM8PD      | Open   | —              |
| **F2QZB4** | Extract the scenario-gate into a standalone /review-spec skill                   | JWM8PD      | Open   | 73CKG4, R09T59 |
| **CS86B0** | Codify absorption: emit native vitest test skeletons (optional)                  | JN39KG      | Open   | —              |

`Done` = shipped in `bdd/SCENARIOS.md`, verified, and closed (`verify.md` present). 4/7 children done.

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
- _(optional / stretch)_ `/codify` exists as an optional skill emitting **native vitest test skeletons** — deferrable, since `test-definitions.md`'s R/G/R checkboxes already provide the "N tests to pass" denominator.
- All **required** child tickets are `done` (CS86B0 is optional).
- Worked example in SCENARIOS.md exercises all the new checks against a sample scenario set.

## Related

- **DZ2NM5** (Phase 0 merge) — sibling epic. Scenario numbering, persona references, AC structure flow from Phase 0 into Phase 1.
- **MBGQ89** (ticket-deps schema) — standalone safeword improvement that landed first; pairing/blocking fields used here.

## Replan — 2026-06-06 validation pass

Revalidated against the live arcade source, safeword's current `bdd` skill, and current Claude Code / Opus skill-authoring + BDD research (`/figure-it-out`). Direction holds; **calibrated absorption, not verbatim port** — children carried arcade's Python-shaped assumptions and ~40% duplication with machinery safeword already has.

**Open decisions — resolved:**

1. **codify placement** → standalone optional skill. "Fold into Phase 5 decomposition" is moot — safeword retired the `decomposition` phase (FSX1PP) after this epic was drafted. Emission must be **TypeScript-native** (CS86B0); arcade's Python/pytest-bdd/.feature does not run here.
2. **/review-spec shape** → both (auto-fire from scenario-gate + re-invokable). (F2QZB4)
3. **findings format** → adopt arcade's structured format. (R09T59)
4. **storage shape** → resolved by DZ2NM5 shipping `spec.md`.
5. **sizing** → features only; tasks keep the lighter inline AODI check.

**Cross-cutting (applied to children):**

- **Vocabulary drift** — "Phase 3 / Phase 4" here map to the **Define Behavior** and **Scenario Quality Gate** (`scenario-gate`) sections of the current `bdd/SCENARIOS.md` (named-phase migration, DKETNZ).
- **Dedup** — of the 5 scenario rules, only **outcome-oriented** + **no-or** are genuinely new; **externally-verifiable** duplicates AODI **Observable** (reference, don't restate). Of the 4 Phase-4 checks, only **vacuous-pass** is genuinely new; negative-case / assertion-strength / determinism are named specifics layered on existing AODI + adversarial pass, not new sections.
- **BDD correctness fix** — "Singular Then (one Then, no `and`)" is contradicted by BDD canon (Dan North's founding example, Fowler, Cucumber all `And`-join Then). Reframe to **one behavior / one When-Then pair**. (XN5SPN)
- **Missing structural rules** to add (more fundamental than some of the 5, currently absent): one When per scenario, Given = state not action, Scenario Outline for data variation. (XN5SPN)
- **Don't inherit arcade bugs** (if codify ported): arcade's own canonical status is `asserted`, but its codify-spec writes `codified` (an arcade bug) and maps from a stale "behaviors / Edge Cases" spec shape — and safeword has no spec-status field at all, so port neither.
- **Skill placement** — an invoked skill stays resident all session (Anthropic skill docs), so rules belong in the phase file (SCENARIOS.md), not SKILL.md; new skills reference, not restate, scenario-gate logic.

## Status — 2026-06-06 (post-implementation)

The replan above is the design record; its child notes are written forward-looking — read them against this. What's actually shipped vs remaining:

- **Shipped (verified + closed):** XN5SPN (construction rules), 9FSPM8 (vacuous-pass), XBY5QR (negative-case lens), 73CKG4 (determinism risks), plus VZK191 (post-review polish) — all in `bdd/SCENARIOS.md` (template + dogfood).
- **Remaining:** **R09T59** — structured findings format, now a retrofit onto the already-shipped checks; **F2QZB4** — extract `/review-spec`, now blocked only on R09T59 (73CKG4 done); **CS86B0** — optional, TS-native, low-priority.
- **Arcade-side decommissions** (JWM8PD, JN39KG) — unchanged, still blocked on the safeword side.

## Work Log

- 2026-05-24T21:27:52.411Z Started: Created ticket 0AWSY8
- 2026-05-24T21:30:00.000Z Drafted: Epic shell with 7 children, sequencing, 5 open decisions, many-to-one pairing rationale
- 2026-06-06T17:40:00.000Z Replan: validated epic + 7 children vs live arcade source + current docs/BDD research (/figure-it-out). Resolved 5 open decisions; recorded dedup, BDD Then-rule correction, TS-native codify, missing structural rules, vocabulary drift, arcade bugs-not-to-inherit. Tickets-only pass; build deferred.
- 2026-06-06T22:58:00.000Z Reconciled (post-quality-review): re-tensed the replan into a shipped-vs-remaining Status section; marked XN5SPN/9FSPM8/XBY5QR `Impl` + corrected their table titles and CS86B0's (native vitest, not .feature); narrowed F2QZB4 deps to 73CKG4+R09T59; re-scoped 73CKG4 to determinism-only; demoted CS86B0 to optional in Done-when; tightened the asserted/codified wording (safeword has no spec-status field).
- 2026-06-06T23:35:00.000Z 73CKG4 closed: Determinism risks subsection added to the scenario-gate (Luo et al. + Fowler grounding), verified, marked Done. Epic 4/7 children done; remaining R09T59 + F2QZB4 (+ optional CS86B0).
