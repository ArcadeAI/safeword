# Verify: Orient agents at worktree entry

Verified: 2026-08-03T05:41:11Z against `origin/main` release v0.72.0.

## Verify Checklist

**Test Suite:** ✓ 6446/6446 tests pass (428 files; 5 intentional skips)
**Gherkin:** ✅ Acceptance lane passes (823/823 executed scenarios; 3 intentional skips)
**Build:** ✅ Success (tsup ESM and DTS)
**Lint:** ✅ Clean (ESLint, Gherkin lint, Prettier, and `tsc --noEmit`)
**Scenarios:** ⏭️ Skipped — patch ticket has no test-definitions.md
**PR Scope:** ✅ Diff matches the user-approved combined #1780/#1802 closeout scope; #1780 changes are limited to canonical/dogfood standing guidance, direct and installed-behavior tests, and this ticket's artifacts
**Dep Drift:** ✅ Clean (no dependencies changed; `bun audit` reports no vulnerabilities)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ Acceptable friction — Walked a coding agent through worktree entry; worst step = one four-command identity check; new explicit steps vs before = 1 deterministic identity check; expected benefit = replacing speculative path probes and repeated repair commands
**Surface Evidence:** ⏭️ N/A — no affected-surface inventory in this patch ticket; canonical and installed `.safeword/SAFEWORD.md` boundaries are exercised directly
**Evidence limits:** ✅ None

Audit passed — 0 errors and 0 warnings. Diff-scoped config sync is healthy; dependency-cruiser reports 0 violations; changed tests use specific observable assertions, isolated temporary repositories, and a real CLI setup boundary; configured documentation sources (`README.md` and website docs) contain no conflicting root-entry claim; learning, principle-trace, and domain-reference checks are clean. Repository-wide Knip, clone, and dependency-freshness discovery are intentionally outside diff-audit scope.

Quality review APPROVED against the live issue, current main, the generated-architecture contract, and Git's `rev-parse` documentation. Its only suggestion—assert every orientation-command component—was applied and verified.

Post-release catch-up evidence: the focused behavior lane passes 21/21 tests; the separate release-config lane passes 5/5 tests; Claude plugin release contract aligns at v0.72.0; full lint and typecheck remain clean.

Current-run quality-review invocation proof was recorded before the review passes; the final read-only reviewer produced a verdict but did not write a second invocation entry.
