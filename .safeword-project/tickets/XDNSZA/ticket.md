---
id: XDNSZA
slug: impl-plan-artifact
title: 'Impl plan as first-class artifact with Approach / Decisions / Arch alignment / Known deviations / Assessment triggers + status lifecycle'
type: feature
phase: define-behavior
status: in_progress
epic: bdd-phase-two-merge
paired_with: SXNV8N
created: 2026-05-24T21:37:59.745Z
last_modified: 2026-06-10T22:30:00.000Z
scope:
  - 'impl-plan-template.md in packages/cli/templates/doc-templates/ — 5 sections (Approach, Decisions table, Arch alignment, Known deviations, Assessment triggers), **Status:** planned|implemented line, HTML-comment guidance, skip: callout per section'
  - 'hooks/lib/impl-plan.ts parser (jtbd.ts cross-runtime-copy pattern): parse status line + per-section content-or-skip with non-empty trimmed reason (parse-annotation rule)'
  - 'stop-quality.ts cumulative gate: features at implement/done phases require impl-plan.md with all 5 sections content-or-skip'
  - 'SCENARIOS.md scenario-gate exit step rewritten: test-layer assignment + sequencing output lands in impl-plan.md Approach; TDD.md entry references the plan'
  - 'Template↔dogfood sync: packages/cli/templates/skills/bdd ↔ .claude/skills/bdd, hooks templates ↔ .safeword/hooks'
  - 'Worked example: populated impl-plan.md for a small feature in SCENARIOS.md or TDD.md'
out_of_scope:
  - 'ADR consultation content for Arch alignment — K4BWTQ (template ships the section; consultation step populates it later)'
  - 'Reconciliation logic + implement→verify status gate — ERVA6V'
  - 'Harness degraded path — CNGBNT'
  - 'safeword check coverage validators beyond the hook gate (lineage/coverage checks unchanged)'
  - 'Retrofitting impl-plan.md onto in-flight tickets — forward-looking only, same grandfathering as DZ2NM5 D5'
done_when:
  - 'Template exists and scaffolds cleanly; skip: convention documented inline'
  - 'Hook blocks stop for features at implement/done without a valid impl-plan.md (5 sections content-or-skip, status line present); pre-existing tickets without the artifact are exempt (grandfathered)'
  - 'SCENARIOS.md exit + TDD.md entry reference impl-plan.md; dogfood copies in sync (parity green)'
  - 'Tests cover parser (status, sections, skip variants) and gate (missing file, missing section, bare skip, whitespace reason, grandfathered ticket)'
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

## Replan — 2026-06-10 (epic validation pass)

Inherited decisions now resolved — see M6D315 replan:

- **Storage:** sibling file `impl-plan.md` in the ticket folder (DZ2NM5's sibling-artifact pattern won; the "## Implementation section in ticket.md" branch is dead).
- **Authoring point:** scenario-gate exit — SCENARIOS.md's exit step 3 (test-layer assignment + sequencing, absorbed from the retired decomposition phase) becomes "write impl-plan.md"; that output is the Approach section. "Phase 6" in this ticket reads as the named `implement` phase.
- **VYRKBJ folded in:** this ticket also ships the `skip: <non-empty reason>` convention for sections (template callout + gate accepts content-or-skip + `safeword check` validation: bare `skip:` error, whitespace-only reason error, empty section without skip error). The implement-entry gate must accept skips from day one.
- **Hook surface:** gates live in the stop-quality.ts cumulative-artifact checks (not pre-tool-quality); integrate with the existing BddPhase machine and Tier-2 review stamps, don't build parallel machinery.

## Work Log

- 2026-05-24T21:37:59.745Z Started: Created ticket XDNSZA
- 2026-05-24T21:39:00.000Z Drafted: Scope (5 sections + lifecycle + storage), template, hook integration; linked to epic M6D315
- 2026-06-10T22:20:00.000Z Replan: storage + authoring point resolved (impl-plan.md sibling, scenario-gate exit); VYRKBJ skip-discipline scope folded in; named-phase vocabulary applied.
- 2026-06-10T22:30:00.000Z Intake exit: /figure-it-out settled remaining design (Decisions table; **Status:** bold-label line; Approach includes task breakdown; uniform non-empty skip rule; gate phases implement+done, routed on spec.md presence for grandfathering). scope/out_of_scope/done_when written. Autonomous session — user sub-phase gates auto-confirmed per standing instruction ("proceed as you see fit"). Phase → define-behavior.
