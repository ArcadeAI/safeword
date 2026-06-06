---
id: XN5SPN
slug: phase-3-scenario-rules
title: 'Make scenario-construction rules explicit in the Define Behavior phase'
type: task
phase: done
status: done
epic: bdd-phase-one-merge
created: 2026-05-24T21:27:52.458Z
last_modified: 2026-05-24T21:30:00.000Z
---

# Make scenario-construction rules explicit in the Define Behavior phase

**Goal:** Give the `bdd` skill explicit, named scenario-construction rules at authoring time (the Define Behavior phase) so common Given/When/Then defects are prevented as scenarios are written, not only caught later in the scenario-gate review.

**Parent epic:** 0AWSY8
**Depends on:** —

## Scope

Add a **"Scenario construction rules"** subsection to the Define Behavior section of `bdd/SCENARIOS.md` — the shipped template (`packages/cli/templates/skills/bdd/SCENARIOS.md`) plus safeword's dogfood mirror (`.claude/skills/bdd/SCENARIOS.md`), kept in parity. A compact, fix-first named list with ✓/✗ micro-examples:

- **One behavior, one `When`** — a single event and its outcome. Multiple `And`-joined `Then` lines for facets of the _same_ outcome are fine; a second behavior or `When` means a second scenario.
- **Outcome-oriented `Then`** — assert what is true after the `When`, not how the system gets there.
- **Declarative, business language** — name the intent, not the UI mechanics ("submits the form" ✓, "clicks `#submit`" ✗). Subsumes the original "outcome-oriented + readability" pair.
- **`Given` is state, not action** — establish the world; actions belong in `When`.
- **No `or` in the `Then`** — one outcome per scenario; use a `Scenario Outline` for legitimate input→output variation.

External verifiability cross-references the scenario-gate's **Observable** check (AODI) rather than restating it. Coaching only — no hook enforcement (parsing G/W/T is brittle, and Opus guidance favors light framing).

**Correction baked in:** the original plan's "Singular Then — one `Then` line, no `and`" was wrong by BDD canon (Dan North, Fowler, and Cucumber all join `Then` assertions with `And`); the real rule is one behavior / one When-Then pair. The set also adds three structural rules the original five missed: one `When`, `Given` = state, and `Scenario Outline` for variation.

## Out of scope

- Vacuous-pass, assertion strength, negative-case coverage, determinism — scenario-gate review checks (separate Phase 1 tickets).
- Findings-format changes — R09T59.
- Hook-enforcement of the rules — coaching only.

## Done when

- The Define Behavior section of `SCENARIOS.md` documents the rules as a compact fix-first list with ✓/✗ examples, in both the template and the dogfood mirror, with parity intact.
- External verifiability points to the scenario-gate **Observable** check instead of duplicating AODI.
- markdownlint clean; the new rules neither contradict nor duplicate the existing AODI table.

## Work Log

- 2026-05-24T21:27:52.458Z Started: Created ticket XN5SPN
- 2026-05-24T21:30:00.000Z Drafted: Scope, 5 rules, open question; linked to epic 0AWSY8
- 2026-06-06T17:40:00.000Z Replan: corrected "singular Then" (BDD-canon error) → one-behavior/one-When-Then-pair; dedup externally-verifiable vs AODI Observable; added 3 missing structural rules; form/placement per Anthropic skill docs; re-sized to task. Build deferred.
- 2026-06-06T18:20:00.000Z Implemented: added "Scenario construction rules" to bdd SCENARIOS.md (template + dogfood mirror) — 5 fix-first rules (one-behavior/one-When, outcome-oriented Then, declarative, Given=state, no-or + Scenario Outline) with ✓/✗ micro-examples and an Observable cross-ref to the scenario-gate. Compact form (no full before/after pairs, no separate worked-example block) per skill-authoring bloat research. Verified: parity-check 120 pairs + 3 contracts in sync, markdownlint 0 errors. Formal /verify + /audit close gate still pending.
- 2026-06-06T18:36:00.000Z Refactored ticket: consolidated original scope + replan + implementation into one coherent current spec — folded corrections into Goal/Scope/Done-when, dropped the superseded original text and the resolved open question, retitled "Phase 3" → "Define Behavior". Work Log preserved; decisions unchanged.
