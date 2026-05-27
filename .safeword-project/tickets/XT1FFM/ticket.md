---
id: XT1FFM
slug: cross-reference-numbering
title: 'Adopt slug.persona.AC.scenario numbering for traceability'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-zero-merge
paired_with: QEKGBK
created: 2026-05-24T15:21:55.058Z
last_modified: 2026-05-24T15:22:00.000Z
---

# Adopt `slug.persona.AC.scenario` numbering for traceability

**Goal:** Adopt arcade's canonical numbering scheme — `<slug>.<persona-code><JTBD#>.AC<#>.<scenario_name>` — so every scenario name carries its lineage back to the AC, JTBD, and persona it proves.

**Why:** Today, safeword scenarios live under markdown headings with no formal back-reference. When a scenario fails or gets revised, there's no machine-checkable link to which AC it proves or which JTBD that AC serves. The numbering makes lineage explicit and lets tooling check coverage (every AC has ≥1 scenario; no orphan scenarios).

**Parent epic:** DZ2NM5

**Depends on:** 31W8M3 (AC layer)

## Scope

- Adopt the scheme: `<slug>.<persona-code><JTBD#>.AC<#>.<scenario_name>` where `scenario_name` is snake_case.
- Example: `oauth-flow.PO1.AC2.change_association_applies_to_subsequent_auth`.
- Update `bdd` Phase 3 (define-behavior) so scenario names follow this scheme, and so the hook that parses `test-definitions.md` validates the scheme.
- Update `codify-spec`-equivalent codegen (if it lands later) so emitted `.feature` files preserve the scheme as scenario names or tags.
- Add a coverage check: every AC has ≥1 scenario; flag orphan scenarios (no matching AC).
- Update `test-definitions.md` template to show the numbering format.

## Out of scope

- Migrating existing safeword tickets to the new scheme (epic decision #5).
- Changing scenario internal structure (Given/When/Then format, R/G/R checkboxes) — those stay.

## Done when

- Numbering scheme documented in safeword templates and SAFEWORD.md.
- `bdd` Phase 3 enforces the scheme.
- Coverage check (every AC → ≥1 scenario) implemented in the appropriate hook.
- Worked example in SCENARIOS.md shows the numbering in action.

## Open questions

- Backward-compat for tickets that pre-date the merge: keep both schemes valid forever, or migrate? Inherits epic decision #5.
- Length: long slugs + long scenario_names can produce 60+ character IDs. Truncation rule, or accept long names?
- Tag vs name in `.feature` files: should the scheme be the scenario name, a tag, or both?

## Work Log

- 2026-05-24T15:21:55.058Z Started: Created ticket XT1FFM
- 2026-05-24T15:22:00.000Z Drafted: Scope, depends, open questions; linked to epic DZ2NM5
