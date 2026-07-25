# Verify: Environment-portable tracker transport (CBTDK8)

## Verify Checklist

**Test Suite:** ✓ 5378/5378 tests pass (7 skipped; 1 environment-limited failure excluded — see Evidence limits). The feature's own coverage: 24 new unit + wiring tests across `plan.test.ts`, `apply-results.test.ts`, `command-plan-apply.test.ts`; the full `tracker-sync` suite (114 tests) is green, proving the `gh` path is unchanged.
**Gherkin:** ✅ Acceptance lane passes — the cucumber integration lane is green; this feature's `.feature` is `@wip`-excluded (#363, no live tracker in tests) and proven by the vitest units above.
**Build:** ✅ Success — tsup ESM + DTS build succeeded in the verify run.
**Lint:** ✅ Clean — eslint clean on all changed files; `tsc --noEmit` clean; gherkin lint clean.
**Scenarios:** All 19 scenarios marked complete (58/58 RGR + cross-scenario ledger rows; 0 unchecked).
**PR Scope:** ✅ Diff matches ticket scope — 11 files, all the plan/apply seam (`contract.ts`, `plan.ts`, `apply-results.ts`), the required shared-helper extraction (`ticket-references.ts` + `index.ts` import rewrite, leaving the `gh` path unchanged), the command wiring (`commands/sync-tracker.ts`, `cli.ts`), the `.feature`, and tests. No piggybacked changes.
**Dep Drift:** ✅ Clean — no new dependencies; the design honors the existing `tracker-sync` one-way-projection boundary (ARCHITECTURE.md) and adds no runtime dep.
**Parent Epic:** KKNFZA (off-board local ticketing) — sibling DGH59K done (shipped via #1086); 01EAKC blocked/follow-up; CBTDK8 this ticket.
**Reconcile:** ✅ No pattern deviation — the plan/executor seam extends the existing one-way projection; `buildGraphProjection` left on the `gh` path, shared ref-resolution factored into `ticket-references.ts`. The versioned JSON contract is flagged in impl-plan.md as an ADR candidate (soft; not yet recorded).
**Experience:** Walked the Technical Builder through `sync-tracker --plan | executor` in a `gh`-less environment; worst step = there is no packaged executor yet, so the builder must hand the plan JSON to their own tool (agent/CI) — deferred to a follow-on child by design; new steps vs before = the mirror now works at all where `gh` is absent (removes a dead-end rather than adding one). — soft, never blocks.
**Evidence limits:** ⚠️ `tests/hooks/self-report.test.ts` › "reports failure when the marker cannot be written" fails only because it `chmod 0o555`s a dir and expects the write to fail — container **root bypasses permission bits**, so the write succeeds and the assertion flips. Outside this ticket's diff (nothing in `hooks/self-report` was touched) and reproduces independently of this change; not product evidence.

**Audit:** Audit passed — depcruise 0 errors (new modules have no layer violations; the 1 warning is pre-existing `codex-plugin`), config in sync (no W007), knip dead-code cleaned (un-exported internal contract member types, commit bc79735), test quality good (exact-value assertions, behavior-oriented, independent, no sleeps, error/boundary coverage via Scenario Outline). Errors: 0, Warnings: 0 (mine).

## Notes

- `safeword sync-tracker --plan` emits the `SyncPlan` JSON to stdout offline (no credential, no network); `--apply-results <file>` reads → validates → folds executor results into the tracker-map and saves; the two flags are mutually exclusive; no-flag routes to the unchanged live `gh`/Linear path.
- Internal-id guard verified: `--apply-results` rejects a result whose `url` tail ≠ `number` (catches the spike's internal id `4764539863`), and requires `url` present so the guard can't be skipped.
