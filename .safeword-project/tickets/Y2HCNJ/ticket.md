---
id: Y2HCNJ
slug: jtbd-format
title: 'Add JTBD as Phase 0 artifact (When-I-I-want-so-I-can)'
type: feature
phase: define-behavior
status: in_progress
epic: bdd-phase-zero-merge
paired_with: 89HX2E
created: 2026-05-24T15:21:54.968Z
last_modified: 2026-05-28T05:45:00.000Z
scope:
  - 'JTBD artifact format — a quoted "When I…, I want…, so I can…" statement, one named persona validated against `.safeword-project/personas.md` via `validatePersonaReference` (from 7YN5QB), and a short title.'
  - "JTBD-level identifier `<slug>.<persona-code><JTBD#>` (e.g. `oauth-flow.PO1`). This is the fixed prefix XT1FFM's full `<slug>.<persona-code><JTBD#>.AC<#>.<scenario_name>` scheme extends downward. Y2HCNJ assigns and formats the JTBD-level id only."
  - 'Storage — JTBDs live in a new per-ticket `spec.md` (epic D2) under a `## Jobs To Be Done` section. spec.md section order: Intent → References → Personas → Vocabulary → Jobs To Be Done → Outcomes. Y2HCNJ ships the template with all six headers but wires only the JTBD sub-step (AC structure under each JTBD is 31W8M3).'
  - 'New `packages/cli/templates/spec-template.md` (the six-section scaffold with a worked JTBD example).'
  - '`safeword ticket new` scaffolds `spec.md` alongside `ticket.md` for `type: feature` only — rendered inline in `ticket-writer.ts` mirroring `ticket.md`; not schema-registered (per-ticket artifacts like ticket.md/test-definitions.md/dimensions.md are not in the schema).'
  - 'New-feature `ticket.md` template drops `**Why:**`, keeps a one-line `**Goal:**` stub, and adds a `**See:** spec.md` pointer (epic D2).'
  - 'bdd Phase 0 (DISCOVERY.md + the paired `templates/skills/bdd/DISCOVERY.md`) gains a JTBD authoring sub-step after "Load project glossary" and before "Understanding" (epic D1 product-first order): patient-coaching cue (guide away from implementation), draft-from-the-user''s-words cue, one-persona-per-JTBD split rule, persona-ref validation, and a conversational pause-and-confirm presenting the full JTBD list.'
  - 'Intake-exit gate (`pre-tool-quality.ts`, both `templates/hooks/` and the deployed `.safeword/hooks/` copy): when `spec.md` exists (D5 new-flow routing), deny advancing past intake / creating test-definitions.md unless the spec has ≥1 JTBD whose persona ref resolves against personas.md, OR a `skip: <reason>` declaration in the JTBD section. Empty/whitespace skip reason is denied. Mirrors the existing dimensions.md escape valve.'
  - '`templates/SAFEWORD.md` (and the dogfood `.safeword/SAFEWORD.md`) Phase 0/Clarify description mentions the JTBD sub-step.'
  - 'vitest coverage in `packages/cli/tests/`: spec.md scaffolded on `--type=feature` and NOT on task/patch; ticket.md template shape change; gate passes on valid JTBD+resolving persona, passes on `skip: <reason>`, denies on missing JTBD, denies on empty skip reason, denies on unresolvable persona ref.'
out_of_scope:
  - 'Acceptance Criteria authoring and AC structure nested under JTBDs (31W8M3).'
  - 'AC/scenario numbering, coverage checks, orphan-scenario detection, and scenario-name pattern enforcement (XT1FFM) — Y2HCNJ stops at the JTBD-level id.'
  - 'Scenario authoring (existing Phase 3).'
  - 'Changing how engineering scope/out_of_scope/done_when are captured — those stay as-is, sequenced after JTBD/AC per epic D1.'
  - 'Retroactive `spec.md` scaffold for existing in-flight tickets — D5 grandfathers them; the gate routes by `spec.md` presence.'
  - "Cross-tool sync with arcade's `.project/personas.md` convention (P8RJ4M)."
  - 'A configurable path for `spec.md` — it is a per-ticket artifact inside the ticket folder, not a project-config file like personas/glossary; no `configKey`.'
  - "Hook-enforced pause-and-confirm / sub-phase tracking — B0JZQN owns structured signoff gates; Y2HCNJ's pause-and-confirm is conversational only."
  - "Schema registration of per-ticket `spec.md` (diverges from the epic's non-binding files-affected rollup — see Design decisions)."
done_when:
  - '`packages/cli/templates/spec-template.md` exists with all six section headers and a worked JTBD example in the documented "When I…, I want…, so I can…" form.'
  - '`safeword ticket new --type=feature` scaffolds `spec.md` next to `ticket.md`; `--type=task` and `--type=patch` do not.'
  - 'A newly scaffolded feature `ticket.md` uses `**Goal:**` + `**See:** spec.md` and contains no `**Why:**`.'
  - 'bdd DISCOVERY.md (and its paired template) has the JTBD sub-step after "Load project glossary" with the coaching cues, persona-ref validation, and pause-and-confirm; a worked example shows a JTBD authoring turn.'
  - 'The intake-exit gate denies advancing a new-flow feature (spec.md present) past intake without ≥1 JTBD whose persona resolves, unless a non-empty `skip: <reason>` is present; the gate logic is byte-identical in `templates/hooks/` and `.safeword/hooks/`.'
  - '`validatePersonaReference` is invoked when a JTBD names a persona; unresolvable refs are flagged, not invented.'
  - '`templates/SAFEWORD.md` Phase 0 mentions the JTBD sub-step.'
  - 'All new behaviors are covered by vitest in `packages/cli/tests/` following the existing personas/glossary patterns; full suite green.'
---

# Add JTBD as Phase 0 artifact (When-I-I-want-so-I-can)

**Goal:** Capture persona-anchored motivations as structured "Jobs To Be Done" in a new per-ticket `spec.md`, authored in `bdd` Phase 0 before engineering scope, using the canonical "When I…, I want…, so I can…" form with one-persona-per-JTBD discipline.

**Why:** Scope/done-when answers "what we'll build." JTBD answers "why it matters and to whom." JTBD is stable across implementation changes; scope isn't. Without JTBDs, scope drift is invisible — you don't notice the motivation changed when only the implementation moved.

**Parent epic:** [DZ2NM5](../DZ2NM5/ticket.md)

**Depends on:** 7YN5QB (personas ✓), K7N2QM (configurable paths ✓) — both done.

## Design decisions

Two inherit from the epic; two were resolved at intake via `/figure-it-out`; one diverges from the epic's non-binding rollup.

### Inherited from DZ2NM5

- **Sub-ordering (D1) — product-first.** JTBD authoring sits before engineering scope: orientation → JTBD → AC → scope/done-when → specificity self-test.
- **Storage (D2) — `spec.md` sibling.** JTBDs live in `spec.md`, not `ticket.md`. The ticket template loses `**Why:**` and gains a `**See:** spec.md` pointer for new feature tickets.

### Resolved at intake (`/figure-it-out`, 2026-05-28)

- **Gate strictness — `skip: <reason>` escape valve.** When `personas.md` is empty (7YN5QB deliberately allows "proceed without"), the intake-exit gate accepts either ≥1 JTBD whose persona resolves, or a `skip: <reason>` in the JTBD section. Chosen over a hard ≥1 requirement (contradicts 7YN5QB's soft path) and soft-prompt-only (no audit trail, evaporates under YOLO). Mirrors the existing `dimensions.md` and SHA-or-skip gates — safeword's gate philosophy is conscious, auditable opt-out, not hard block.
- **Numbering boundary — JTBD-level id ships here.** Y2HCNJ assigns `<slug>.<persona-code><JTBD#>` (e.g. `oauth-flow.PO1`); XT1FFM extends it to AC/scenario and owns all coverage/orphan/pattern validation. Rationale: a requirement id is intrinsic to the artifact (RTM practice), the immediate dependent 31W8M3 attaches ACs _under_ JTBDs and needs an anchor, and the prefix is forward-compatible with XT1FFM's specified scheme — no double build.

### Diverges from the epic's files-affected rollup

- **No schema registration for `spec.md`.** The rollup listed registering per-ticket `spec.md` in `schema.ts`. But per-ticket artifacts (`ticket.md`, `test-definitions.md`, `dimensions.md`) are not schema-managed — only project-config and `.safeword/templates/` docs are. `spec.md` is a ticket artifact, scaffolded inline by `ticket-writer.ts`. Adding schema globbing for per-ticket paths would be machinery without reuse. The epic flags its rollup as "planning-level, not a binding contract."

## Work Log

- 2026-05-24T15:21:54.968Z Started: Created ticket Y2HCNJ
- 2026-05-24T15:22:00.000Z Drafted: Scope, depends, open questions; linked to epic DZ2NM5
- 2026-05-28T05:45:00.000Z Resolved Phase 0 (intake): Mapped all code surfaces (spec-template.md absent; ticket-writer.ts inline render; pre-tool-quality.ts:230-300 gate; DISCOVERY.md + paired template; validatePersonaReference from 7YN5QB). Confirmed per-ticket artifacts aren't schema-registered → spec.md follows suit (divergence from epic rollup recorded). Open questions closed via `/figure-it-out`: gate = `skip: <reason>` escape valve (consistency with dimensions.md/SHA-or-skip gates + Nielsen Norman user-control); numbering = JTBD-level id here, AC/scenario validation deferred to XT1FFM (RTM identifier-at-creation + 31W8M3 needs the anchor). Corrected stale `.project/personas.md` → `.safeword-project/personas.md`. Scope/out_of_scope/done_when written to frontmatter. Phase advanced intake → define-behavior.
