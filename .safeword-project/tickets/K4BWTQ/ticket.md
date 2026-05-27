---
id: K4BWTQ
slug: adr-consultation
title: 'Add required ADR consultation step and ADR-creation prompt for new patterns'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-two-merge
paired_with: SXNV8N
blocked_on: XDNSZA
created: 2026-05-24T21:37:59.788Z
last_modified: 2026-05-24T21:39:00.000Z
---

# Required ADR consultation step + ADR-creation prompt

**Goal:** Add a Phase 5 (or impl-plan-authoring) step that reads project-local ADRs from the conventional location (`docs/arch/` by default, configurable via `.safeword/config.json`), surfaces relevant decisions, and — when no ADRs exist — prompts the user to consider whether the current implementation's patterns warrant the first ADR.

**Why:** Today safeword's Phase 5 vaguely references `.safeword/guides/design-doc-guide.md` and `architecture-guide.md` for "complex features," but consultation is optional and there's no project-local ADR convention. Arcade's `/implement-spec` requires reading `docs/docs/arch/*` and populating the impl plan's Arch alignment section from those decisions. Without this: implementations drift from architectural decisions silently, and the team accumulates undocumented patterns.

**Parent epic:** M6D315
**Paired with:** SXNV8N in arcade
**Depends on:** XDNSZA (Arch alignment section must exist before we can populate it)

## Scope

### ADR location convention

- Default: `docs/arch/` at project root (matches arcade's `docs/docs/arch/` after one-level normalization for safeword's flatter convention).
- Configurable via `.safeword/config.json` field: `"adrLocation": "<path>"`.
- Recognize ADR files by either numeric prefix (`0001-foo.md`, `002-bar.md`) or `ADR-` prefix. README.md in the ADR directory is ignored.

### Consultation step

Add to the impl-plan authoring flow (inside Phase 5 or wherever the impl plan section lands):

1. List ADRs at the configured location.
2. **If ADRs exist:** read all of them. Note any decisions directly relevant to the feature being implemented (storage, data ownership, interface patterns, cross-service communication). Populate the impl plan's Arch alignment section with the relevant ADR titles.
3. **If no ADRs exist:** populate the Arch alignment section with the canonical "None recorded yet" copy, then prompt the user:

> **No architectural decisions have been recorded yet.** Consider whether this implementation introduces patterns worth documenting as the first ADR — for example: technology choices that span multiple features, data ownership decisions, or cross-service communication protocols.
>
> Would you like to draft the first ADR before proceeding with implementation, or continue now and document it afterward?

Wait for the user's answer before proceeding.

### Hook integration

- When the Arch alignment section is populated with the "None recorded yet" copy, no further check needed — the user was prompted at write-time.
- When the Arch alignment section references ADRs by title or ID, the `safeword check` validator (per the MBGQ89 existence check) ensures the referenced ADR files actually exist.

## Out of scope

- ADR template / format design — defer to project conventions; safeword consumes whatever the project writes.
- Auto-extracting decisions from existing safeword guides (`architecture-guide.md`) — those stay as guidance.
- Validating that the impl plan's claims about ADR alignment are actually correct — humans review, hook just validates existence.

## Done when

- ADR location is configurable in `.safeword/config.json` with `docs/arch/` default.
- Phase 5 / impl-plan-authoring flow includes the read + populate-or-prompt step.
- Hook (or `safeword check`) validates that ADR references in the Arch alignment section resolve to real files.
- Worked example shows both branches: with-ADRs and without-ADRs.

## Open questions

- **ADR naming convention enforcement** — does safeword require numeric/ADR-prefix, or accept any `.md` file in the directory? Driver leans accept-any (don't impose convention on projects that already have ADRs in non-conforming names).
- **Subdirectory recursion** — recurse into `docs/arch/subdir/`? Driver leans no for v1 (flat directory); revisit if real projects need nested structure.
- **What counts as an ADR?** Arcade matches `[0-9]*.md`. Should safeword match the same, or be more permissive? Driver leans match arcade for consistency, but with the config override for projects that want a different pattern.

## Work Log

- 2026-05-24T21:37:59.788Z Started: Created ticket K4BWTQ
- 2026-05-24T21:39:00.000Z Drafted: Scope (location + consultation step + prompt), hook integration, 3 open questions; linked to epic M6D315
