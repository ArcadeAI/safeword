# Verify: Environment-portable tracker transport (CBTDK8)

_Third pass. The first close was premature — verify/audit had run only partially and
`/quality-review` (on code) and `/refactor` had not run at all. All four were then genuinely run. A subsequent PR review
(#1424) held the branch on a fourth gap — an overstated parity claim — closed here as #1443/#1441.
The results below are from the full runs on the final code._

## Verify Checklist

**Test Suite:** ✓ 5384/5384 tests pass (7 skipped; 1 environment-limited failure excluded — see Evidence limits). Feature coverage: 39 tests across `plan.test.ts`, `apply-results.test.ts`, `command-plan-apply.test.ts` (wiring) and `plan-gh-parity.test.ts` (equivalence); the full `tracker-sync` suite is **135 green**, which covers both `gh`-path regression and `gh`-path parity.
**Gherkin:** ✅ Acceptance lane passes — `lint-gherkin` clean; the cucumber lane is green. This feature's `.feature` is `@wip`-excluded (#363, no live tracker in tests) and proven by the vitest units above.
**Build:** ✅ Success — tsup ESM + DTS build succeeded in the verify run; the website build is clean (9 pages) after the docs addition.
**Lint:** ✅ Clean — full-repo `bun run lint` (eslint `src tests` + `lint:gherkin` + `tsc --noEmit`) completed with zero error/warning output; `tsc --noEmit` re-run independently exits 0.
**Scenarios:** All 23 scenarios marked complete (0 unchecked, cross-scenario row resolved).
**PR Scope:** ✅ Diff matches ticket scope — the plan/apply seam (`contract.ts`, `plan.ts`, `apply-results.ts`), the required shared-helper extraction (`ticket-references.ts` + `index.ts` import rewrite, `gh` path unchanged), the command wiring (`commands/sync-tracker.ts`, `cli.ts`), the `.feature`, tests, and the customer-visible docs section the plan called for. No piggybacked changes.
**Dep Drift:** ✅ Clean — no new dependencies; honors the existing `tracker-sync` one-way-projection boundary (ARCHITECTURE.md).
**Parent Epic:** KKNFZA (off-board local ticketing) — sibling DGH59K done (shipped via #1086); 01EAKC blocked/follow-up; CBTDK8 this ticket.
**Reconcile:** ✅ No pattern deviation — the plan/executor seam extends the existing one-way projection; `buildGraphProjection` left on the `gh` path. `impl-plan.md` reconciled to **implemented** with three Known deviations recorded (corpus-order intents, self-blocked-by exclusion, GitHub-only url guard). The versioned JSON contract remains an open ADR candidate, deferred to the second executor.
**Experience:** Walked the Technical Builder through `sync-tracker --plan | executor` in a `gh`-less environment; worst step = there is no packaged executor yet, so the builder hands the plan JSON to their own tool (agent/CI) — deferred to a follow-on child by design, and now documented with a worked example in the tracker-integration guide; new steps vs before = the mirror works at all where `gh` is absent (removes a dead-end rather than adding one). — soft, never blocks.
**Evidence limits:** ⚠️ `tests/hooks/self-report.test.ts` › "reports failure when the marker cannot be written" fails only because it `chmod 0o555`s a directory and expects the write to fail — container **root bypasses permission bits**, so the write succeeds and the assertion flips. Outside this ticket's diff (nothing in `hooks/self-report` was touched); not product evidence.

**Audit:** Audit passed — depcruise 0 errors (new modules introduce no layer violation; the 1 warning is pre-existing `codex-plugin`), `sync-config --check` in sync (no W007), knip clean (dead exports removed in `bc79735`), jscpd **0 clones** across the changed modules, outdated deps = eslint dev/patch only (low risk, no prod deps), test quality good (exact-value assertions, behavior-oriented, independent, no sleeps, error/boundary coverage), docs updated and the site builds. Errors: 0, Warnings: 0 (mine).

**PR review round (#1424 → #1441, #1443):** A reviewer held the PR — correctly — because the parity claim in its description was overstated: "the 121-test `tracker-sync` suite still passes" is regression evidence (nothing broke), not equivalence evidence (the plan describes the same work the live path would do). Closed on this branch:

- **#1443** `plan-gh-parity.test.ts` — drives the REAL `syncTracker` orchestrator with recording fake writers and `computePlan` over the same corpus + same starting sidecar, asserting the plan's intents reproduce the writer calls actually made (same tickets, same kind create/update-open/close-terminal, same ref, same payload) across minimal and full body modes and the empty corpus. Only the network boundary is faked. Non-vacuous by mutation: collapsing close→update, corrupting the ref, and skipping never-synced tickets each fail it.
- **#1441** `runPlan` parity — provider guard (unconfigured project now emits an empty-but-valid plan instead of an all-`create` one, mirroring the live path's friendly no-op) and the `body: full` egress advisory (mirrors the live fail-safe; visibility cannot be confirmed offline, so an unconfirmed repo warns). Both advisories go to **stderr** so stdout stays a pure `SyncPlan` — asserted.
- Branch caught up to `main` (16 commits, no file overlap).

**Quality-review:** APPROVE from an independent fresh-context reviewer of the shipped code — no critical bugs; the fold was traced exhaustively (all 6 state combinations correct) and stdout purity confirmed. Its 7 robustness/coverage findings were applied in `8d57cb9`: `urlTail` strips query/fragment, the identity guard is provider-gated to GitHub plus a numeric `number` check, `rejectReason` extracted, and six test gaps closed (validate-all-before-mutate with a mixed row, query-string url, non-numeric number, terminal-never-synced create-closed, parent-over-epic precedence, corrupt-sidecar command branch).

## Notes

- `safeword sync-tracker --plan` emits the `SyncPlan` JSON to stdout offline (no credential, no network); `--apply-results <file>` reads → validates → folds executor results into the tracker-map and saves; the two flags are mutually exclusive; no-flag routes to the unchanged live `gh`/Linear path.
- Internal-id guard: `--apply-results` rejects a result whose `url` tail ≠ `number` (catches the spike's internal id `4764539863`), requires `url` present so the guard can't be skipped, and (GitHub) requires `number` to be purely numeric.
