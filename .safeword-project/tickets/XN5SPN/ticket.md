---
id: XN5SPN
slug: phase-3-scenario-rules
title: 'Make scenario-construction rules explicit in Phase 3'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-one-merge
created: 2026-05-24T21:27:52.458Z
last_modified: 2026-05-24T21:30:00.000Z
---

# Make scenario-construction rules explicit in Phase 3

**Goal:** Add explicit named rules for scenario construction during Phase 3 authoring — singular Then, outcome-oriented, externally verifiable, no-or in Then, readability (business language not implementation) — with examples. Today these are implicit in safeword's Phase 3 and only caught downstream in Phase 4 review; making them explicit during authoring prevents the violations in the first place.

**Parent epic:** 0AWSY8
**Depends on:** —

## Scope

- Update `bdd/SCENARIOS.md` Phase 3 section to add a "Scenario construction rules" subsection with:
  - **Singular Then** — "One Then assertion. No 'and' joining two outcomes. Multi-line Given with `And` is fine — the rule applies to the Then." Example pair (violation + fix).
  - **Outcome-oriented Then** — "describes what is true after the When, not how the system gets there." Example pair.
  - **Externally verifiable Then** — "what an outside observer would see — a response code, a returned value, a visible state change." Example pair.
  - **No 'or' in Then** — "Pick one outcome and split off the other into its own scenario." Example.
  - **Readability** — "Business language, not implementation. 'When the user submits the form' ✓; 'When the user clicks the submit button' ✗." Example pair.
- Coaching: if a scenario starts to violate these rules, split it on the spot — don't accumulate violations and clean up later.
- These are authoring-time guidelines (Phase 3); Phase 4 review still checks them adversarially (covered by other Phase 1 children).

## Out of scope

- Vacuous-pass, assertion strength, negative-case coverage, determinism — those are Phase 4 review checks (separate tickets).
- Findings format changes — covered by R09T59.

## Done when

- SCENARIOS.md Phase 3 documents the 5 rules with violation/fix example pairs each.
- A worked example shows in-flight rule application (catch + split during authoring).
- Phase 4's existing AODI section remains; the new rules don't duplicate AODI — they catch construction-time issues, not post-hoc validation issues.

## Open questions

- Should rule violations be hook-enforced (block test-definitions.md write when a scenario violates a rule), or coaching only? Driver leans coaching only — hook-enforcement requires parsing G/W/T which is brittle.

## Replan — 2026-06-06 (corrected scope supersedes the original above)

Validated via `/figure-it-out` + BDD-canon research.

**Correction (load-bearing):** "Singular Then — one Then, no `and`" is **wrong** by BDD canon — Dan North's founding ATM example, Fowler's Given-When-Then, and Cucumber all join Then assertions with `And`. The real rule is **one behavior = one When-Then pair**; multiple `And`-joined Then lines verifying facets of the _same_ outcome are correct. Shipping the literal form would teach an anti-pattern.

**Corrected rule set** for the **Define Behavior** section (= old "Phase 3") of `bdd/SCENARIOS.md`:

- **One behavior / one When-Then pair** (replaces "singular Then") — multiple `And` Then lines for one outcome OK; a second _behavior_ → split.
- **Outcome-oriented Then** — what is true after, not how. (genuinely new)
- **No "or" in the Then** — split; point at **Scenario Outline** for legitimate input→output variation. (genuinely new)
- **Declarative / readable** — business language, not UI mechanics ("submits the form" ✓, "clicks submit" ✗). Subsumes old rules 2 + 5; strongest-attested idea in the literature.
- **Externally-verifiable** — _reference_ AODI **Observable** in the scenario-gate section, don't restate. Frame as business-observable, not strict black-box.

**Add the 3 structural rules the original 5 miss** (more fundamental, currently absent): **one When per scenario**, **Given = state not action**, **Scenario Outline for data variation**.

**Form / placement** (Anthropic skill docs): tight named list, fix-first positive framing with a one-line "why", compressed examples (positive snippet preferred over full before/after) — in SCENARIOS.md's Define Behavior section, not SKILL.md. **Coaching-only** (open question resolved: no hook-enforcement — brittle, and Opus guidance favors light framing).

**Sizing:** this is a **task** (additive skill docs, one file), not a feature — the full scenario-writing machinery shouldn't fire on a doc edit to the scenario-writing machinery. Update any skill-content contract test if present.

## Work Log

- 2026-05-24T21:27:52.458Z Started: Created ticket XN5SPN
- 2026-05-24T21:30:00.000Z Drafted: Scope, 5 rules, open question; linked to epic 0AWSY8
- 2026-06-06T17:40:00.000Z Replan: corrected "singular Then" (BDD-canon error) → one-behavior/one-When-Then-pair; dedup externally-verifiable vs AODI Observable; added 3 missing structural rules; form/placement per Anthropic skill docs; re-sized to task. Build deferred.
