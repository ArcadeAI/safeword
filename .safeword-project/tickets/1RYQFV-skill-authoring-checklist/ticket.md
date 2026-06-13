---
id: 1RYQFV
slug: skill-authoring-checklist
parent: VKNF1T-platform-uplift-epic
type: patch
phase: intake
status: in_progress
created: 2026-06-13T01:07:16.496Z
last_modified: 2026-06-13T01:07:16.496Z
---

# Skill-authoring checklist: template + dogfood + schema + pairs + full suite

**Goal:** Codify the new-skill checklist — template + byte-identical dogfood copy + `SAFEWORD_SCHEMA` entry + `SKILL_CURSOR_PAIRS`/`ACTION_SKILLS` decision + run the FULL test suite — as a short guide (or a `safeword check` validation).

**Why:** `/explain` (NTT094) shipped with two latent parity failures that only the full suite caught. The steps exist as tribal knowledge spread across learnings and schema code; nothing tells the next skill author (human or agent) the complete list. A checklist at the point of authoring prevents the repeat.

## Scope sketch

- A short guide (likely `.safeword/guides/` or learnings) listing the five steps with file paths; or one additive `safeword check` validation if a guide can't enforce.
- If a guide: template + dogfood byte-identical pair.
- Out of scope: new enforcement hooks, restructuring SAFEWORD_SCHEMA.

## Work Log

- 2026-06-13T01:07:16.496Z Started: Created ticket 1RYQFV
