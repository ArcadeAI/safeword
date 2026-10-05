## Verify Checklist

Evidence source: CI on PR #5376 at head `6da6514896d565f2b7ebd9507e1639eb7ee32c3a` (workflow run 37243251773), the user-designated gate for this change.

**Test Suite:** ✓ 10228/10228 tests pass (9 skipped; CI `test (node 24.18.1)` and `test (node 22.23.2)` green)
**Gherkin:** ✅ Acceptance lane passes (596 scenarios, 11118 steps passed in CI)
**Build:** ✅ Success (CI test jobs build `packages/cli` before running)
**Lint:** ✅ Clean (CI `lint` job; local eslint clean on changed files)
**Typecheck:** ✅ Clean (CI `lint` job runs `tsc --noEmit`; local `tsc --noEmit -p packages/cli` clean)
**Scenarios:** ⏭️ Skipped — patch ticket, no test-definitions.md
**Refactor:** ✅ Completed — 6da651489 folded lock-busy status into the acquire branch
**PR Scope:** ✅ Diff matches ticket scope (lock-busy exit code + message, closeout wait/report, their tests, regenerated plugin surfaces and Cursor lifecycle fixture)
**Dep Drift:** ✅ Clean (no dependency changes)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — Walked a developer running closeout while another worktree runs package tests; worst step = waiting up to 30 min for the lock before a "lock is busy" blocker; new steps vs before = 0 (previously a false "local verification failed")
**Surface Evidence:** ⏭️ N/A — no affected surfaces declared
**Evidence limits:** ✅ None

Quality review: Codex cross-agent review found no issues in this diff; a pre-existing recovery-marker race (#2761) is tracked separately.
