---
id: Y2HCNJ
slug: jtbd-format
title: "Add JTBD as Phase 0 artifact (When-I-I-want-so-I-can)"
type: feature
phase: intake
status: in_progress
epic: bdd-phase-zero-merge
paired_with: 89HX2E
created: 2026-05-24T15:21:54.968Z
last_modified: 2026-05-24T15:22:00.000Z
---

# Add JTBD as Phase 0 artifact (When-I-I-want-so-I-can)

**Goal:** Capture persona-anchored motivations as structured "Jobs To Be Done" in Phase 0, using the canonical "When I…, I want…, so I can…" form, with one-persona-per-JTBD discipline.

**Why:** Scope/done-when answers "what we'll build." JTBD answers "why it matters and to whom." JTBD is stable across implementation changes; scope isn't. Without JTBDs, scope drift is invisible — you don't notice the motivation changed when only the implementation moved.

**Parent epic:** DZ2NM5

**Depends on:** 7YN5QB (personas)

## Scope

- Define the JTBD artifact format: quoted "When I…, I want…, so I can…" statement, named persona (from `.project/personas.md`), short title.
- Numbering: `<slug>.<persona-code><JTBD#>` — e.g., `oauth-flow.PO1`.
- Add JTBD authoring as an explicit Phase 0 sub-step in `bdd` (after orientation, before scope).
- Coaching rule: **one persona per JTBD**. If a JTBD conflates motivations from two personas, split it.
- Coaching cue for the agent: "Be patient — humans often struggle to articulate the why because it gets tangled with implementation. Patiently but firmly guide them away from implementation details."
- Coaching cue: if the user can't articulate a JTBD cleanly, offer to draft one from what they've said and ask them to refine.
- Pause-and-confirm: present the full JTBD list at the end of the sub-phase; iterate until user signs off.
- Storage: JTBDs live in ticket.md under a `## Jobs To Be Done` section (subject to epic decision #2 on storage shape).

## Out of scope

- AC authoring (31W8M3).
- Scenario authoring (existing Phase 3).
- Modifying scope/out-of-scope/done-when capture — those remain as-is.

## Done when

- JTBD format spec documented in safeword templates.
- `bdd` Phase 0 has a JTBD sub-step with coaching cues and a pause-and-confirm gate.
- Persona validation (from 7YN5QB) is invoked when a JTBD names a persona.
- Worked example in DISCOVERY.md shows JTBD authoring turn.

## Open questions

- Sub-ordering: JTBD before or after engineering scope? Inherits epic decision #1.
- Minimum JTBDs per feature — one, or is "1+ required" the rule?
- Persona overlap: if multiple personas share a motivation, is that one JTBD with multiple persona refs, or multiple JTBDs? Arcade chose multiple JTBDs.

## Work Log

- 2026-05-24T15:21:54.968Z Started: Created ticket Y2HCNJ
- 2026-05-24T15:22:00.000Z Drafted: Scope, depends, open questions; linked to epic DZ2NM5
