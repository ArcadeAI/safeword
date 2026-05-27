---
id: XDNSZA
slug: impl-plan-artifact
title: 'Impl plan as first-class artifact with Approach / Decisions / Arch alignment / Known deviations / Assessment triggers + status lifecycle'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-two-merge
paired_with: SXNV8N
created: 2026-05-24T21:37:59.745Z
last_modified: 2026-05-24T21:39:00.000Z
---

# Impl plan as first-class artifact

**Goal:** Add an impl plan as a first-class artifact written before code, with five named sections — Approach, Decisions (with alternatives-considered-and-rejected), Arch alignment, Known deviations, Assessment triggers — and a status lifecycle (`planned` → `implemented`).

**Why:** Today safeword's Phase 5 (decomposition) produces informal task-breakdown notes in ticket.md. There's no upfront design artifact that captures _why_ a particular implementation approach was chosen, what alternatives were considered, or what future signals would prompt revisiting. Arcade's `<slug>-impl.md` captures all of this. Without it: decisions go undocumented, alternatives are forgotten, and the team can't tell whether a current pattern is intentional or accidental.

**Parent epic:** M6D315
**Paired with:** SXNV8N in arcade
**Depends on:** —

## Scope

### Five named sections

1. **Approach** — How will each scenario / behavior be satisfied? Which service, layer, or component owns it? Includes the task breakdown that safeword's Phase 5 produces today (the test-layer assignment, the component analysis).
2. **Decisions** — For each significant technical choice (storage, queue, interface, data model), name the choice, name the alternatives considered, name why the alternatives were rejected. One row per decision.
3. **Arch alignment** — Which existing ADRs does this implementation honor? Read from the project-configured ADR location (per K4BWTQ).
4. **Known deviations** — Where will this deviate from current arch guidance, and why is that acceptable? Surface drift intentionally.
5. **Assessment triggers** — What future changes would prompt re-evaluating these choices? Forward-looking — sets up the conditions for revisiting the design.

### Status lifecycle

- `planned` — plan written, implementation not yet started.
- `implemented` — implementation complete; plan reconciled against shipped reality (per ERVA6V).

### Storage shape (inherits epic decision #1)

- If single-ticket.md model wins: impl plan is a `## Implementation` section inside `ticket.md` with the five sub-sections.
- If separate-files: `<id>-impl.md` next to `ticket.md`.

Either way, the five sections are the same.

### Template

Add a template to `packages/cli/templates/doc-templates/impl-plan-template.md` (or as a section of `ticket-template.md` depending on storage shape).

### Hook integration

- When advancing into Phase 6 (`implement`), the hook checks that an impl plan exists with all 5 sections (or `skip: <reason>` per VYRKBJ).
- When advancing out of Phase 6 (`implement` → `verify`), the hook checks that the impl plan status is `implemented` (per ERVA6V).

## Out of scope

- ADR consultation step content — K4BWTQ.
- Plan-vs-actual reconciliation logic — ERVA6V.
- `skip:` annotation convention for sections — VYRKBJ.
- Test-harness graceful degradation — CNGBNT.

## Done when

- Template exists in `packages/cli/templates/doc-templates/`.
- DECOMPOSITION.md and TDD.md updated to reference the impl plan as an artifact.
- Hook checks that impl plan exists (with all 5 sections or skip-annotated) at Phase 6 entry.
- Worked example shows a populated impl plan for a small feature.

## Open questions

- **Decisions section format** — table per decision (Choice | Alternatives considered | Rejected because) or per-decision sub-section? Driver leans table for scannability, but complex decisions might warrant prose.
- **Approach section vs decomposition table** — does Approach include the task breakdown table (test layer assignments, ordering), or is the task breakdown a separate sub-section? Driver leans included — they're inseparable.

## Work Log

- 2026-05-24T21:37:59.745Z Started: Created ticket XDNSZA
- 2026-05-24T21:39:00.000Z Drafted: Scope (5 sections + lifecycle + storage), template, hook integration; linked to epic M6D315
