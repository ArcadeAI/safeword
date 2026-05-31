# Verify: 1J6JKP — prefix→exact eslint/prettier config detection

## Verify Checklist

**Test Suite:** ✓ 209/209 tests pass (`test:done` gate subset — hooks + schema), plus 191 blast-radius tests green (lint-config 8, session-lint-check E2E 50, check 25, detect 12, reconcile/schema/dogfood 96)
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint src tests + tsc)
**Scenarios:** ⏭️ N/A — task; the extracted `lib/lint-config.ts` detector is unit-tested
**Dep Drift:** ✅ Clean — no new dependencies (test imports only Node built-ins)
**Parent Epic:** DZ2NM5 (Phase 0 merge)

## Test-infra note (why not the 12-min full suite)

A concurrent **parallel Claude session** was running `npx vitest run` against this
shared tree. My full-suite attempts contended with it — one flaky module-load
cascade (`detect.test.ts` "is not a function" — passes in isolation, with others,
and the export exists), one hang from two competing vitest processes, and one
SIGTERM. None were code failures. The designated gate subset (`test:done`) ran
clean in 3.4s, and every file my change touches passes in isolation.

## Scope → evidence

- **Detection fixed both ways:** the dogfood repo's `eslint.config.ts` is now
  detected (original false-negative), and a `.bak`-disabled config reads as
  missing (false-positive the full suite caught). Switched from prefix-match to
  exact known-filename enumeration. RED `be04239c` → GREEN `707d826a` → fix
  `32cddab1`.
- **Verified lists:** the eslint/prettier extension sets are complete vs current
  docs (prettier.io / eslint.org, fetched this session). The package.json/
  package.yaml config-key location is a documented out-of-scope edge.
- **Issue 2 dropped:** project-wide biome was already superseded by
  `post-tool-lint.ts` (revalidated).
- Hook mirror + schema registration synced; both hook copies identical.

**Next:** Mark 1J6JKP done.
