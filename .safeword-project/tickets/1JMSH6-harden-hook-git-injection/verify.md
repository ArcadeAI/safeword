# Verify — Ticket 1JMSH6: Harden hook git calls against shell injection

## Verify Checklist

**Test Suite:** ✓ 2400/2400 tests pass (1 pre-existing skip; full suite, dist rebuilt)
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (eslint 0 warnings; typecheck 0 errors)
**Scenarios:** ⏭️ N/A — task (no test-definitions.md; +9 inline unit tests added)
**Dep Drift:** ✅ Clean (no dependency changes)
**Parent Epic:** N/A (spun off from 153's /quality-review finding; standalone)
**Reconcile:** ⚠️ 1 deviation, 0 missing uplevel — `execFileSync` over the repo's `execSync` convention at the interpolated-input sites; justified (closes the injection class, same call as 153). Soft, doesn't block.

## Audit

**Architecture:** ✅ depcruise clean (no circular deps / layer violations)
**Dead code:** ✅ `isValidSha` reachable via `checkSha`; no orphans (knip)
**Security:** ✅ the free-text `sha` → `git cat-file` shell sink is closed (execFileSync, no shell) + rejected by `isValidSha` before git; conformed `post-tool-quality` countLoc excludes and `session-auto-upgrade` git add/commit to arg-arrays
**Parity:** ✅ 116 pairs in sync

Audit passed

## Done-when coverage

- No file-derived value reaches a shell via these git calls — `stop-quality` `isReachable` (execFileSync), `post-tool-quality` countLoc, `session-auto-upgrade` git add/commit ✓
- A malicious annotation cannot execute — `isValidSha` rejects metacharacters (`parse-annotation.test.ts`) and `ledger-validation.test.ts` proves the metacharacter sha never reaches the oracle ✓
- `templates/hooks/` ↔ `.safeword/hooks/` byte-identical; full suite + parity + typecheck green ✓
- Out of scope (noted): `bunx safeword@${latest}` — registry semver, not file-derived

**Next:** Mark 1JMSH6 done; it folds into PR #185.
