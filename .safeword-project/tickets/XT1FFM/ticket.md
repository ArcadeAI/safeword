---
id: XT1FFM
slug: cross-reference-numbering
title: 'Adopt slug.persona.AC.scenario numbering for traceability'
type: feature
phase: verify
status: in_progress
epic: bdd-phase-zero-merge
paired_with: QEKGBK
created: 2026-05-24T15:21:55.058Z
last_modified: 2026-05-30T18:50:00.000Z
scope:
  - Adopt the scenario-name scheme `<slug>.<persona-code><JTBD#>.AC<#>.<scenario_name>` (snake_case `scenario_name`, arcade-exact) as the `### Scenario:` title in test-definitions.md, extending 31W8M3's AC id downward. Long IDs accepted — no truncation.
  - Coverage REPORT in `safeword check` (advisory, like persona/glossary drift — NOT a blocking gate): flag each AC in a ticket's spec.md with no matching scenario, and each scenario whose `<jtbd-id>.AC<#>` prefix matches no AC (orphan). Needs a src-side spec/AC parser mirroring the hook-side `parseAcsByJtbd`.
  - Docs: SCENARIOS.md documents the scheme with a worked example; SAFEWORD.md carries a one-line scheme reference; the scaffolded test-definitions scenario shows the numbered title.
out_of_scope:
  - `.feature` codegen / codify-spec tag-vs-name — no codegen exists in safeword; the spec-pipeline codegen is a separate epic (DZ2NM5 excludes it).
  - Any hard gate on scenario-name format or AC coverage — report-only (converged Q2); `pre-tool-quality.ts` is untouched.
  - Migrating existing tickets' scenarios to the scheme — new-flow only (epic D5).
  - Changing scenario internals (Given/When/Then, RED/GREEN/REFACTOR checkboxes).
done_when:
  - Scheme documented in SCENARIOS.md (worked example) + SAFEWORD.md.
  - `safeword check` reports uncovered ACs and orphan scenarios for a ticket whose spec.md has ACs and a test-definitions.md — covered by unit tests on the parser + report.
  - The scaffolded test-definitions scenario shows the numbered scheme.
  - Full suite + lint green; templates synced.
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
- 2026-05-30T18:28:00.000Z Re-validated on pickup: depends-on 31W8M3 done (AC id `<slug>.<persona-code><JTBD#>.AC<#>` shipped). Dropped stale `.feature`-codegen scope (no codegen in safeword; separate epic). Converged 3 design Qs: snake-exact title (arcade fidelity), coverage = `safeword check` REPORT not a gate, accept long IDs. Authored real DEV JTBD + 2 ACs (personas/glossary now bootstrapped — no skip). Phase 0-2 → define-behavior.
- 2026-05-30T18:33:00.000Z Phase 3 scenario set converged (NOT yet saved to test-definitions.md): 9 scenarios / 3 rules — R1 title→AC-ref parse (conformant→ref, free-text→none); R2 `safeword check` report (covered AC not flagged, uncovered AC flagged, orphan flagged, free-text flagged, multi-scenario-per-AC covered); R3 degradation (no test-defs → no flags, no ACs → empty). /quality-review APPROVE (AODI clean). /figure-it-out: report THREE buckets — **uncovered AC**, **stale AC ref** (JTBD matches, AC# doesn't), **orphan** (JTBD/ref absent). Impl note: need a NEW AC-**id** parser (parseAcsByJtbd returns counts only); src-side in check.ts mirrors hook-side → M6D315's 5th consumer. Session handed off here.
- 2026-05-30T18:42:00.000Z Complete: Phase 3 — saved dimensions.md + test-definitions.md (9 scenarios across 3 rules) with arcade-exact numbered titles (`cross-reference-numbering.DEV1.AC1|AC2.<snake>`). → scenario-gate.
- 2026-05-30T18:43:00.000Z Complete: Phase 4 — AODI re-validated all 9 (atomic/observable/deterministic/independent); adversarial pass clean (malformed title folds into the free-text/no-ref partition — not a separate class). → decomposition. Build order: (A) AC-id parser hook-side lib/jtbd.ts (returns AC ids per JTBD, not counts) + src-side mirror in src/utils; (B) title→AC-ref parser; (C) coverage report in check.ts (three buckets) wired to the advisory channel.
- 2026-05-30T18:45:00.000Z Phase 5/6: → implement. Report scoped to `status: in_progress` tickets with a spec.md (excludes done predecessor 31W8M3, whose AC-bearing spec + free-text scenarios are the out-of-scope migration case). Pure functions land in src/utils/scenario-coverage.ts (M6D315's 5th section-walk consumer — noted, not unified); check.ts wires them to the advisory channel (non-blocking, exit 0). Hook-side parseAcsByJtbd untouched (counts feed the AC gate).
- 2026-05-30T18:50:00.000Z Complete: Phase 5/6 implementation. RED 4e54813f (12 tests) → GREEN 6bf6b2cd (parseAcReferenceFromTitle/parseAcIdsByJtbd/buildCoverageReport) → check.ts wiring e2eb52c5 (+2 integration tests). Docs 303a586f (SCENARIOS.md scheme+example, SAFEWORD.md ref, test-def template numbered title; both mirrors). 9/9 scenarios marked, cross-scenario skip (no shared-code duplication left). → verify.
