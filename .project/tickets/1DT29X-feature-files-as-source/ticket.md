---
id: 1DT29X
slug: feature-files-as-source
title: 'Gherkin .feature files become the scenario source of truth'
type: feature
phase: implement
status: in_progress
epic: bdd-phase-two-merge
depends_on: [102a, 102b]
scope:
  - 'Author and review behavior from `.feature` files when a ticket has one; keep `test-definitions.md` as the R/G/R ledger that hooks parse.'
  - '`safeword check` reads scenario lineage from Gherkin `@<jtbd>.AC#` tags and falls back to legacy markdown scenario-title parsing only when no feature source exists.'
  - '`safeword codify` derives Vitest skeletons from the `.feature` source when present, while preserving legacy markdown input for older tickets.'
  - 'Update BDD/review/planning templates so future agents create `.feature` files directly and use `test-definitions.md` only for progress tracking.'
out_of_scope:
  - 'Removing legacy markdown scenario parsing or hook support for existing tickets.'
  - 'Replacing the R/G/R hook ledger with tags or a new sidecar file.'
  - 'Native-language step generation or non-TypeScript step definitions.'
  - 'Spec-revision/staleness semantics for changed feature files; sibling ticket 2K46FG owns that.'
done_when:
  - '`safeword check --offline` reports coverage from `.feature` tags when a feature source exists.'
  - '`safeword codify <ticket>` emits a Vitest skeleton from feature-source scenarios, and legacy `test-definitions.md` tickets still work.'
  - 'BDD, review-spec, planning guide, and test-definition templates identify `.feature` as the scenario source of truth and `test-definitions.md` as the progress ledger.'
  - 'Focused unit, command, and Cucumber BDD tests pass.'
created: 2026-06-10T17:33:56.993Z
last_modified: 2026-06-13T00:00:00.000Z
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
- **5AXPHR** — closeout cleanup for stale source-of-truth wording across live safeword instructions.
- **7ES3GW** — follow-up to teach the testing guide how the Gherkin acceptance lane fits the test strategy.

## Work Log

- 2026-06-10T17:33:56.993Z Started: Created ticket 1DT29X
- 2026-06-10T17:40:00.000Z Filed (backlog, Phase 2): carved out of the bdd-flow review (finding R1 — three scenario representations, derived copies can rot). Scope sketch from the 102a architecture record (".feature files are the single source of truth; test-definitions.md becomes planning-only"). Run intake + /figure-it-out (R/G/R rehoming) when picked up.
- 2026-06-13T00:00:00.000Z Revalidated + figure-it-out: 102a/102b are done, Cucumber JS 13 + `@cucumber/gherkin` 39.1.0 are installed, and the current BDD/review/check/codify flow still treats markdown `test-definitions.md` as canonical. Chosen path is the feature-primary bridge: `.feature` files become scenario source for review/check/codify when present, while `test-definitions.md` stays as the hook-owned R/G/R ledger and legacy fallback. Phase -> implement after spec, dimensions, feature source, ledger, and impl plan were authored.
- 2026-06-13T00:00:00.000Z Implemented: added feature-source discovery, official Gherkin parsing, feature-tag coverage, feature-backed `codify`, BDD/review/planning/template updates, and package Cucumber scenarios. Verification passed: focused utility/command/docs suite (68 tests), parser/render suite (36 tests), package `test:bdd` (5 scenarios / 26 steps), root `test:bdd` (1 scenario / 3 steps), package lint/typecheck. Ticket remains open for formal R/G/R commit annotations and verify.md.
- 2026-06-13 Broader docs audit found two follow-ups before closeout: 5AXPHR for stale source-of-truth wording and 7ES3GW for testing-guide acceptance-lane guidance.

## Figure-It-Out Decision

- [x] Phase 1: Decide where scenario truth lives without breaking hook-enforced R/G/R progress.
- [x] Phase 2: Considered three options: big-bang remove markdown scenarios; feature-primary bridge; docs-only codify discipline.
- [x] Phase 3a: Research domains: current Safeword BDD/hook flow, Cucumber/Gherkin tags and rules, installed parser/API surface, coverage/codify architecture.
- [x] Phase 3b: Evidence: Cucumber docs allow one feature per file, `Rule` grouping, 3-5 step examples, and tags on Feature/Rule/Scenario/Scenario Outline/Examples; `@cucumber/gherkin` is already installed and preferred for in-process AST parsing.
- [x] Phase 4: Recommend the feature-primary bridge. Big-bang removal is correct in spirit but breaks current hard gates; docs-only leaves the drift bug intact. The bridge fixes the source-of-truth problem now and keeps the enforcement ledger stable.
