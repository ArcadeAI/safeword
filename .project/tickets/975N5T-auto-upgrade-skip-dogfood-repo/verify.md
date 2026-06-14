# Verify — 975N5T (auto-upgrade skips the dogfood repo)

## Verify Checklist

**Test Suite:** ✓ 2259/2259 tests pass (1 skipped) — full suite, 136 files, exit 0
**Build:** ✅ Success (`tsup` DTS build)
**Lint:** ✅ Clean (`eslint .` + `tsc --noEmit`)
**Scenarios:** ⏭️ N/A — task (TDD, no scenarios)
**Dep Drift:** ✅ Clean (no dependencies added)
**Parent Epic:** N/A

## Evidence

- New `isDogfoodRepo(projectDir)` (`templates/hooks/lib/dogfood.ts`) — true when `packages/cli/templates/` exists OR a root `package.json` is named `safeword`; both plain file reads (mid-merge-safe).
- Guard at the top of `session-auto-upgrade.ts` (right after the `.safeword/` check): `if (isDogfoodRepo(projectDir)) process.exit(0)` — before any version compare, cache read, "available" message, or `bunx safeword upgrade`.
- Unit tests (`tests/hooks/dogfood.test.ts`, 5/5): templates-dir present → true; package-name `safeword` → true; consumer (.safeword/ but no templates, other name) → false; no package.json → false; malformed package.json → false. RED confirmed against a stub (2 true-cases failed), GREEN after.
- No regression: dogfood + auto-upgrade + schema suites green (38); full suite 2259 pass. Lib registered in `schema.ts`; template ↔ `.safeword/` synced.
- Live validation: the deployed guard means this dev repo's next session start no-ops the auto-upgrade — ending the regress→block→restore loop.

Ready to mark done.
