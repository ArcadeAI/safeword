# Verify — A9TQCD (#7688)

## Verify Checklist

**Test Suite:** ✓ 11851/11853 tests pass in the full local `/verify` at 8f2db17b8 (14 skipped). The two failures are `lint-go-context` tests that fail only on a local Go toolchain mismatch (`go1.25.14` vs `go1.27.1`); this change touches no Go.
**Gherkin:** ✅ Acceptance lane passes (599 scenarios passed)
**Build:** ✅ Success
**Lint:** ✅ Clean (pre-commit ESLint and Prettier on every commit)
**Typecheck:** ✅ Clean (`tsc --noEmit`)
**Scenarios:** ⏭️ Skipped — patch ticket, no test-definitions.md
**Refactor:** ✅ Completed — 8f2db17b8 reuses `runTestBdd` for the line-selector run
**PR Scope:** ✅ Diff matches ticket scope (lane-config matcher, revision hash, tests, regenerated surfaces)
**Dep Drift:** ✅ Clean (no dependency changes)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — not persona-facing beyond the CLI fix itself
**Surface Evidence:** ✅ 1/1 — real `bun run test:bdd -- features/line-selector.feature:<line>` in a freshly installed lane runs exactly the selected scenario; fails with the old matcher
**Evidence limits:** ⚠️ Local Go toolchain mismatch; CI on the final head is authoritative for those two tests.

Audit passed — diff audit vs origin/main at 8f2db17b8: no dependency-cruiser violations (382 modules), config current, no docs or agent configs affected.

## Notes

- Cross-agent quality-review cf475e44 (codex gpt-6.1-sol, independence: cross-agent): one finding, that option values such as `--name checkout.feature` are misread as feature paths. It predates this change and is out of scope; proposed as a follow-up task.
- Cucumber 13.2.1's own path parser (`/^(.*?)((?::[\d]+)+)?$/`) confirms the `file.feature:N[:N…]` syntax.
