# Verify: Refuse a plan approval when the plan changes while the prompt is open

Verified: 2026-11-13 against `origin/main` merge base fd784a2fd on commit 5792d3656 (PR ArcadeAI/safeword#7215).

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: 2 Go tests in `tests/hooks/lint-go-context.test.ts` fail locally because `GOROOT` is Go 1.25.14 while the `go` tool is 1.27.1; all other rerun tests pass (173/175), `plan-design-approval.test.ts` + `bdd-proof-tags.test.ts` pass 99/99, and CI's Go jobs pass. Full vitest suite not run locally; CI ran it green.
**Gherkin:** ✅ Acceptance lane passes (599/599 scenarios, 11786 steps)
**Build:** ✅ Success
**Lint:** ✅ Clean (ESLint, Prettier, `tsc --noEmit`)
**Typecheck:** ✅ Clean
**Scenarios:** ⏭️ Skipped — patch ticket has no test-definitions.md; the new scenario outline "A human decision binds only the approach it was shown" is proven by three mapped tests
**Refactor:** ✅ Completed — extracted `presentedApproachDrift` / `presentedApproachRefusal` to keep `approve()` within the complexity limit
**PR Scope:** ✅ Diff matches ticket scope (plan-approval.ts, its integration tests, feature + proof manifest, one docs sentence, regenerated plugin bundles, this ticket)
**Dep Drift:** ✅ Clean (no dependencies changed; `uv audit` clean; `bun audit` reports 2 pre-existing Astro advisories in the website package already on main)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — an approver whose plan changed mid-prompt gets a refusal naming what changed and the exact rerun command
**Surface Evidence:** ✅ 1/1 affected surfaces have recorded proof (`@surface.safeword-cli` via PTY integration tests)
**Evidence limits:** ⚠️ Local Go toolchain mismatch (GOROOT 1.25.14 vs go 1.27.1); affected Go failures are not product evidence and pass in CI

Audit passed — 0 errors and 0 warnings. Diff-scoped sync-config is healthy; dependency-cruiser reports 0 violations; `@surface.safeword-cli` is defined; changed tests assert observable CLI output, ledger contents and phase. Knip, clone and dependency-freshness discovery are outside diff-audit scope.
