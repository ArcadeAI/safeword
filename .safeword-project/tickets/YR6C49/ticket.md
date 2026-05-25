---
id: YR6C49
slug: glossary-file
title: "Add glossary (.project/glossary.md) + vocabulary validation"
type: feature
phase: intake
status: in_progress
epic: bdd-phase-zero-merge
paired_with: KD4BYF
created: 2026-05-24T15:21:54.923Z
last_modified: 2026-05-24T15:22:00.000Z
---

# Add glossary (`.project/glossary.md`) + vocabulary validation

**Goal:** Introduce a project-wide glossary file as the source of truth for domain terms, and reference it from `bdd` Phase 0 so vocabulary stays consistent across tickets.

**Why:** Without a glossary, domain terms drift across tickets — "session", "token", "auth", "user" mean subtly different things in different specs. Drift compounds; readers can't tell whether two scenarios are talking about the same thing.

**Parent epic:** DZ2NM5

**Depends on:** —

## Scope

- Define the `.project/glossary.md` format: term → one-line definition. Optional alias list per term.
- Update `bdd` Phase 0 (and downstream phases that reference vocabulary) to read `.project/glossary.md`.
- Lint-style check: when a ticket introduces a domain term not in the glossary, prompt the user to either define it in `.project/glossary.md` or use an existing term.
- Update `safeword setup` to scaffold an empty `.project/glossary.md` with format header.
- Document: spec-local vocabulary (terms used in only one spec) lives in an optional `Vocabulary` section of that ticket; project-wide terms live in `.project/glossary.md`.

## Out of scope

- AC quality coaching (covered in 31W8M3).
- Automated term-extraction or NLP — humans curate the glossary.

## Done when

- `.project/glossary.md` format documented in safeword templates.
- `bdd` Phase 0 reads the glossary and surfaces vocabulary mismatches.
- `safeword setup` scaffolds an empty glossary.md.
- Test or example demonstrates a new-term prompt.

## Open questions

- Location: `.project/` vs `.safeword-project/`. Inherits epic decision #3.
- How strict is the "new term" check — every noun, or only terms that look domain-specific? Avoid false-positive fatigue.

## Work Log

- 2026-05-24T15:21:54.923Z Started: Created ticket YR6C49
- 2026-05-24T15:22:00.000Z Drafted: Scope, depends, open questions; linked to epic DZ2NM5
