---
id: 7YN5QB
slug: personas-file
title: "Add persona model (.project/personas.md) + Phase 0 validation"
type: feature
phase: intake
status: in_progress
epic: bdd-phase-zero-merge
paired_with: BC53PV
created: 2026-05-24T15:21:54.876Z
last_modified: 2026-05-24T15:22:00.000Z
---

# Add persona model (`.project/personas.md`) + Phase 0 validation

**Goal:** Introduce a project-wide personas file as the source of truth for who features serve, and validate persona references in `bdd` Phase 0 against it.

**Why:** Today, "who is this for" is implicit in safeword's scope/done-when. That elides the question and lets feature scoping drift toward implementation. Persona-anchored motivation is more stable than scope anchored to behavior.

**Parent epic:** DZ2NM5

**Depends on:** —

## Scope

- Define the `.project/personas.md` format: short code (e.g., `PO`, `BU`, `EU`), name, one-sentence role description, optional spec-specific context line.
- Update `bdd` Phase 0 to read `.project/personas.md` at intake.
- Validation rule: if a Phase 0 turn references a persona by name or code that isn't in `.project/personas.md`, flag it and ask whether it's a new persona or a misnamed existing one. Refuse to invent.
- Update `safeword setup` to scaffold an empty `.project/personas.md` with format header + commented-out example.
- Document that persona definitions live only in `.project/personas.md` — never redefined inline in a ticket.

## Out of scope

- JTBD authoring (Y2HCNJ).
- Migrating existing safeword tickets to reference personas.

## Done when

- `.project/personas.md` format documented in safeword templates.
- `bdd` Phase 0 reads + validates persona references.
- `safeword setup` scaffolds an empty personas.md.
- Test or example ticket demonstrates the unknown-persona flag.

## Open questions

- Location: `.project/personas.md` vs `.safeword-project/personas.md`. Inherits epic decision #3.
- Short-code uniqueness rules — case-sensitive? Length limit? Reuse after deprecation?
- Behavior if `.project/personas.md` doesn't exist at intake — block, warn, or auto-scaffold inline?

## Work Log

- 2026-05-24T15:21:54.876Z Started: Created ticket 7YN5QB
- 2026-05-24T15:22:00.000Z Drafted: Scope, depends, open questions; linked to epic DZ2NM5
