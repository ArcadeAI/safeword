---
id: 31W8M3
slug: ac-layer
title: "Add Acceptance Criteria layer between JTBD and scenarios"
type: feature
phase: intake
status: in_progress
epic: bdd-phase-zero-merge
paired_with: T9BNXD
created: 2026-05-24T15:21:55.013Z
last_modified: 2026-05-24T15:22:00.000Z
---

# Add Acceptance Criteria layer between JTBD and scenarios

**Goal:** Introduce Acceptance Criteria (AC) as a structured intermediate layer between JTBDs and scenarios — a single capability or guarantee under a JTBD, with quality coaching that pushes for descriptive product-capability language (not bare action verbs, not implementation details).

**Why:** Today, `bdd` jumps from scope/done-when straight to scenarios. When done-when is coarse, scenarios become unclear about what they're proving. Arcade's AC layer is the rung that makes scenario coverage purposeful — each scenario proves a specific AC, and ACs sum to JTBD fulfillment.

**Parent epic:** DZ2NM5

**Depends on:** Y2HCNJ (JTBD)

## Scope

- Define the AC artifact format: capability/guarantee statement under a JTBD, numbered `<slug>.<persona-code><JTBD#>.AC<#>`.
- Add AC authoring as a Phase 0 sub-step in `bdd`, after JTBD authoring, before scenarios.
- Coaching: push for descriptive AC statements — not bare "user can X" but "user can X reliably, with Y guarantee." Quality bar: scenarios prove the specifics; the AC summarizes the capability holistically.
- Coaching: ACs are capability-level, not implementation-level. "User can revoke their session" ✓; "`DELETE /sessions/<id>` returns 204" ✗ — the latter belongs in a scenario's Then.
- Split-test heuristic: could each clause of a bundled AC ship as a separate complete deliverable, with its own value, independent of the other? If yes → split. If no (sub-operations only make sense together) → keep as one AC.
- Coaching: if an AC starts spawning more than ~10 scenarios in Phase 3, consider whether it should split into two ACs.
- Pause-and-confirm: present full AC list grouped by JTBD; iterate until user signs off.

## Out of scope

- Scenario authoring (existing Phase 3).
- Numbering scheme details for scenarios under ACs (XT1FFM).
- Adversarial AC review (would be `/review-spec` territory if we absorb that pipeline later — separate epic).

## Done when

- AC format spec documented in safeword templates.
- `bdd` Phase 0 has an AC sub-step with quality coaching and a pause-and-confirm gate.
- Worked example in DISCOVERY.md shows AC authoring with a good/bad pair.
- Phase 3 (define-behavior) updated so each scenario links to its parent AC.

## Open questions

- Does AC sign-off block scope/done-when capture, or can they be captured in parallel? Sub-ordering question — inherits epic decision #1.
- Are ACs required, or optional for small features? Arcade requires them; safeword could allow `acs: skip` with reason for very small features.

## Work Log

- 2026-05-24T15:21:55.013Z Started: Created ticket 31W8M3
- 2026-05-24T15:22:00.000Z Drafted: Scope, depends, open questions; linked to epic DZ2NM5
