## Verify Checklist

**Test Suite:** ✓ 10257/10257 tests pass (13 skipped; packages/cli 594 files, plus retro-relay 198 and retro-collector 153). The plan's second full pass had one unrelated failure, `tests/cli-protocol/machine-contract.test.ts`: the `diff` plan digest differed between two back-to-back runs. It passed when rerun alone (3/3) and in CI, and is tracked as a separate follow-up.
**Gherkin:** ✅ Acceptance lane passes (596 scenarios, 11118 steps)
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint + prettier on changed files; pre-commit lint passed)
**Typecheck:** ✅ Clean (tsc --noEmit across packages; astro check 0 errors)
**Scenarios:** All 4 scenarios marked complete
**Refactor:** ✅ Completed — reclaim protocol rewritten to generation/instance owners; the three race tests share one `prepareRecoveryRace` helper
**PR Scope:** ✅ Diff matches ticket scope (runner recovery-marker protocol, its regression tests, this ticket)
**Dep Drift:** ✅ Clean (no dependency changes)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — not persona-facing (internal test-runner lock)
**Surface Evidence:** ⏭️ N/A — no affected surfaces
**Evidence limits:** ⚠️ The supply-chain lane exited non-zero on existing advisories (bun audit: braces, fast-uri, http-cache-semantics, dompurify; pip-audit: urllib3 2.7.0). No dependency files changed and the CI Dependency audit passes, so this says nothing about this change.

Quality review: Codex cross-agent review approved after four rounds. The one finding outside this diff, an active-snapshot cleanup test that can't catch regressions, is tracked as a separate follow-up.
