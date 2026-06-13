# Verify: K4BWTQ — ADR consultation step + ADR-creation prompt

Date: 2026-06-11

## Verify Checklist

**Test Suite:** ✓ 2598/2598 tests pass (165 files; 1 pre-existing skip. One earlier run flaked 3 tests under load — clean re-run confirmed no regression)
**Build:** ✅ Success (tsup + dts clean)
**Lint:** ✅ Clean (eslint + tsc --noEmit)
**Scenarios:** All 10 scenarios marked complete (R/G/R annotated; cross-scenario row skip-annotated with reason)
**Dep Drift:** ✅ Clean (no new dependencies — Node built-ins only)
**Parent Epic:** M6D315 (siblings: 1/4 done before this — XDNSZA ✓; ERVA6V and CNGBNT remain)
**Reconcile:** ✅ No pattern deviation (helper follows configured-paths util pattern; advisory mirrors findCoverageAdvisories; impl-plan.md reconciled at implement exit with one Approach refinement recorded)

Audit passed — config in sync, depcruise 0 errors (pre-existing cucumber.mjs orphan warnings), knip's one real finding (unused exported kind type) fixed in 42680e30; remaining findings are the known hook-template false-positive baseline. Quality review (web research) found and fixed one critical: statSync ENOTDIR through-file crash (nodejs/node#56993) on misconfigured paths.architecture — regression-tested. Refactor pass applied two improvements (extract parseStatus/collectSectionBodies; hoist SKIP_PREFIX), tests green after each.

## What shipped

- `packages/cli/src/utils/architecture-records.ts` — `listArchitectureRecords`: file → the record; directory → top-level `.md` files excluding README.md (accept-any naming, no recursion); absent/through-file → kind absent. 7 unit tests.
- `packages/cli/src/commands/check.ts` — `findArchitectureAdvisories`: structural advisory when an in-progress ticket's impl-plan.md Arch alignment has content but no record exists at the resolved `paths.architecture`. 3 command tests (flag / skip-clean / present-clean).
- `bdd/SCENARIOS.md` (canonical + dogfood) — Arch alignment bullet expanded into the consultation procedure, canonical "None recorded yet" copy, first-ADR prompt, and a both-branch worked example. Doc-presence test over both copies.
- First end-to-end dogfood of XDNSZA's impl plan: authored at scenario-gate exit, reconciled to `implemented` at implement exit.

## Done-when reconciliation

- Helper resolves file-or-directory locations; arcade's `docs/docs/arch` consumed verbatim via the override seam test — ✅
- SCENARIOS.md consultation procedure + no-ADRs prompt + both-branch worked example in both copies — ✅
- `safeword check` flags content-without-location structurally; clean on skip or present — ✅
- Tests cover helper partitions, advisory cells, doc presence — ✅
