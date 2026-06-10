---
id: 1DT29X
slug: feature-files-as-source
title: 'Gherkin .feature files become the scenario source of truth'
type: feature
phase: intake
status: backlog
epic: bdd-phase-two-merge
created: 2026-06-10T17:33:56.993Z
last_modified: 2026-06-10T17:40:00.000Z
---

# Gherkin .feature files become the scenario source of truth

**Goal:** Make the bdd flow author scenarios as Gherkin `.feature` files directly — one source of truth the acceptance lane executes — demoting `test-definitions.md` to planning + R/G/R progress tracking. Kills the three-representations redundancy (markdown G/W/T + emitted vitest + emitted `.feature`) flagged by the 2026-06-10 flow review.

**Why now-shaped:** 102a/102b shipped the lane (every project runs `.feature` via cucumber-js) and codify can emit Gherkin — but the flow still authors markdown scenarios, so the lane sits unfed and derived copies can rot. This slice was explicitly deferred from 102a/102b (`out_of_scope`: "the bdd-flow change — separate slice") and is the arcade-merge critical path (arcade authors `.feature` natively).

## Scope (sketch — refine at intake)

- define-behavior writes `features/<slug>.feature` (lineage as `@tags`, per arcade's taxonomy) instead of markdown G/W/T in test-definitions.md.
- `test-definitions.md` shrinks to planning + per-scenario R/G/R checkboxes referencing scenario names (the prompt hook + gates keep reading it).
- `/review-spec` reads the `.feature`; `safeword check` coverage (uncovered/stale/orphan) parses `@tags` instead of title prefixes.
- codify inverts: emit vitest skeletons / step stubs FROM `.feature` (the test-definitions→gherkin direction becomes obsolete).
- R/G/R rehoming decision (sidecar file vs tags vs keep test-definitions.md) — the hard part; decide at intake with /figure-it-out.

## Out of scope (sketch)

- Spec-revision discipline (status resets, downstream staleness flags) — 2K46FG, same epic.
- Multi-runner / non-TS step defs (102c cancelled; all-TS stands).

## Related

- **102a / 102b** — shipped the runner + lane this slice feeds; both name this as the deferred follow-on.
- **2K46FG** (spec-revision discipline) — sibling under Phase 2; owns regenerate/staleness semantics this slice exposes.
- **M6D315** (Phase 2 epic) — parent context; arcade pair: build-spec's Gherkin authoring (`spec-format.md` "Test artifacts are derived from it").

## Work Log

- 2026-06-10T17:33:56.993Z Started: Created ticket 1DT29X
- 2026-06-10T17:40:00.000Z Filed (backlog, Phase 2): carved out of the bdd-flow review (finding R1 — three scenario representations, derived copies can rot). Scope sketch from the 102a architecture record (".feature files are the single source of truth; test-definitions.md becomes planning-only"). Run intake + /figure-it-out (R/G/R rehoming) when picked up.
