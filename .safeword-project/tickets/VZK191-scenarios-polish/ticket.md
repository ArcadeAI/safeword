---
id: VZK191
slug: scenarios-polish
type: task
phase: verify
status: in_progress
created: 2026-06-06T22:48:46.226Z
last_modified: 2026-06-06T22:48:46.226Z
---

# Apply quality-review polish to bdd SCENARIOS.md

**Goal:** Apply the small content nits the quality-review surfaced in the bdd `SCENARIOS.md` (the file XN5SPN/9FSPM8/XBY5QR landed) so the shipped skill reads cleanly before those tickets close.

**Why:** The session's quality-review sweep flagged a few editorial/coherence nits — house-style spelling, an asymmetric AODI cross-reference, weak wayfinding, duplicated Scenario-Outline guidance. Cheap, and best fixed before the source tickets close.

## Scope

- **Spelling** — `behaviour` → `behavior` (US house style) wherever it slipped in.
- **Atomic symmetry** — the "one behavior / one When" authoring rule silently restated AODI **Atomic** while the externally-observable note deferred to **Observable**. Rewrite the cross-reference to name both gate-mirrors symmetrically and fix the weak "(AODI, below)" wayfinding.
- **Scenario-Outline dedup** — trim the duplicated Scenario-Outline admonition in the negative-case lens; the authoring no-or rule is its canonical home.
- Template (`packages/cli/templates/skills/bdd/SCENARIOS.md`) + dogfood mirror, parity intact.

## Out of scope

- The optional Given-echo before/after example and the "trivially-true" rephrase — the inline forms are adequate; not worth over-editing just-shipped content.
- Any behaviour/rule change — purely editorial.

## Done when

- No UK `behaviour` remains; the AODI cross-reference names both Atomic + Observable; Scenario-Outline guidance is not triplicated.
- Template + dogfood byte-identical (parity), markdownlint clean.

## Work Log

- 2026-06-06T22:48:46.226Z Started: Created ticket VZK191
- 2026-06-06T22:50:00.000Z Implemented: spelling sweep (behaviour→behavior), symmetric AODI cross-ref + "below" wayfinding fix, Scenario-Outline trim in the negative-case lens. Template + dogfood; parity 120 pairs + 3 contracts, markdownlint 0, no "behaviour" remaining. Formal close folds into the batch /verify gate.
