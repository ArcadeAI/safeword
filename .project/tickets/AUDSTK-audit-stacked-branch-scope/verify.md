# Verify: Keep audits focused on stacked branch work

Verified: 2026-08-27T08:20:00Z

## Verify Checklist

**Test Suite:** ✓ 8,505/8,505 tests pass across 527 files; 7 tests skipped
**Build:** ✅ Success through package test prebuilds and plugin generators
**Lint:** ✅ Clean — ESLint, Gherkin lint, and TypeScript checks pass
**Scenarios:** ⏭️ N/A — focused workflow task with unit integration coverage
**PR Scope:** ✅ Explicit audit base, invalid-ref failure, Python scan exclusions, tests, and generated mirrors only
**Dep Drift:** ✅ Clean — no dependency or lockfile changes
**Parent Epic:** N/A
**Reconcile:** ✅ Canonical templates generated into dogfood, Codex, and Claude plugin surfaces
**Experience:** ✅ Stacked branches can select their actual base without repository configuration
**Evidence limits:** ✅ None

Evidence:

- Focused audit contract suite: 34/34 tests pass, including explicit stacked-base scope, invalid-base failure, and Python exclusion arguments.
- Full repository suite: 516 CLI test files plus 11 relay/collector files passed; 8,505 tests passed and 7 skipped.
- `bun run lint` and `bun run typecheck` pass.
- Bash syntax passes for canonical, dogfood, and Claude-plugin audit helpers.
- All 255 parity pairs and 8 contracts are synchronized.
- Claude and Codex plugin generators report current output.
