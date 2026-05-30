---
id: 31W8M3
slug: ac-layer
title: 'Add Acceptance Criteria layer between JTBD and scenarios'
type: feature
phase: define-behavior
status: in_progress
epic: bdd-phase-zero-merge
paired_with: T9BNXD
created: 2026-05-24T15:21:55.013Z
last_modified: 2026-05-30T17:16:00.000Z
scope:
  - Define the AC artifact format — a capability/guarantee statement nested under a JTBD in spec.md, id `<jtbd-id>.AC<n>` (e.g. `oauth-flow.PO1.AC1`), in descriptive product-capability language (not bare action verbs, not implementation).
  - spec-template.md — add an Acceptance Criteria subsection structure under each JTBD heading.
  - New AC parse + gate logic (extend `hooks/lib/jtbd.ts` or a sibling lib) — parse AC entries under each JTBD; an AC gate requires ≥1 AC under each non-skipped JTBD, with a `skip: <reason>` valve mirroring the JTBD/dimensions gates. Wire into `pre-tool-quality.ts` alongside the JTBD gate (routes on spec.md presence, per epic D5).
  - DISCOVERY.md — AC authoring sub-step AFTER "Author Jobs To Be Done", BEFORE engineering scope (product-first, epic D1). Coaching: capability-not-implementation, the split-test heuristic, the ~10-scenarios-per-AC split cue; plus pause-and-confirm.
  - SCENARIOS.md (Phase 3) — each scenario links to its parent AC.
  - Unit + integration tests; register any new lib in schema.ts; sync template ↔ `.safeword/`.
out_of_scope:
  - Scenario authoring mechanics (existing Phase 3) and the `slug.persona.AC.scenario` SCENARIO numbering scheme — that downward extension is XT1FFM. 31W8M3 defines the AC-level id only.
  - Adversarial AC review (a future `/review-spec`-style pipeline epic).
  - Making ACs mandatory — they stay optional via the `skip: <reason>` valve (JTBD/dimensions precedent).
  - Backfilling AC into in-flight tickets — new-flow only (spec.md-routed, epic D5).
done_when:
  - AC format documented in spec-template.md; an AC sub-step in DISCOVERY.md with a good/bad coaching pair and a pause-and-confirm gate.
  - A spec.md-routed gate requires ≥1 AC under each non-skipped JTBD and honors a `skip: <reason>` valve; covered by unit + integration tests.
  - SCENARIOS.md updated so each Phase-3 scenario links to a parent AC.
  - Full suite + lint green; templates synced.
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
- 2026-05-30T17:16:00.000Z Re-validated on pickup: premise current — Y2HCNJ shipped the spec.md JTBD structure AC nests under; no staleness from this session's hook work. Open questions resolved: sub-ordering = epic D1 (product-first); AC optional via `skip:` valve (JTBD/dimensions precedent). Scope→frontmatter; spec.md with JTBD skip (internal tooling). Phase 0-2 → define-behavior.
