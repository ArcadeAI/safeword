# Verify — HEA4VR

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: 11848/11852 pass (14 skipped); the 4 failures are the local Go toolchain mismatch (`compile: version "go1.25.14" does not match go tool version "go1.27.1"`, 2 tests in `tests/hooks/lint-go-context.test.ts`) and OpenCode/review-probe timeouts (`bunx --bun opencode-ai@1.18.23 --version` timed out; `REVIEW_ROUTES_EXHAUSTED` in `tests/cli-protocol/review-wiring.test.ts`). Targeted: `tests/hooks/stamp-coverage-generated.test.ts`, `tests/hooks/review-receipt.test.ts`, `tests/integration/review-receipt-wiring.test.ts` ✓ 76/76 tests pass.
**Gherkin:** ✅ Acceptance lane passes (599/599 scenarios, 11786 steps)
**Build:** ⚠️ Local environment limitation: build lane fails only on the same Go toolchain mismatch; the TypeScript build (tsup/DTS) succeeds.
**Lint:** ✅ Clean (eslint + prettier via pre-commit)
**Typecheck:** ✅ Clean
**Scenarios:** ⏭️ Skipped — task ticket with no test-definitions.md; done_when items covered by the targeted tests above
**Refactor:** ✅ No change warranted — the stamp helper reads as resolve → isolate → query → parse; hook templates cannot import `packages/cli/src`, so the check-attr isolation is inlined instead of shared with `review/packet.ts`
**PR Scope:** ✅ Diff matches ticket scope (stamp coverage set, rejection message, staged-edit gap from cross-agent review; the rest is regenerated mirrors and fixtures)
**Dep Drift:** ✅ Clean (no dependencies added)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — reuses the isolated `git check-attr --source` approach from `review/packet.ts`
**Experience:** ⏭️ N/A — not persona-facing (agent workflow gate internals)
**Surface Evidence:** ✅ 1/1 affected surfaces have recorded proof — implement-phase stamp: `bun .safeword/hooks/write-review-stamp.ts --phase implement` on this branch accepted review `c22c0d71-3ef9-4aea-9169-b553e14d8b74`, which covered only the hand-written files and left out the 8 `plugin/` and `packages/cli/codex-plugin/` mirrors
**Evidence limits:** ⚠️ Go toolchain mismatch and OpenCode/review-probe timeouts are local-only; confirm in CI

## Review and audit

- Cross-agent quality review (Codex, gpt-6.1-sol): changes requested twice, both fixed: bare `linguist-*` declarations reported as `set`, and a staged edit reverted in the working tree. Approved on the third pass: `c22c0d71-3ef9-4aea-9169-b553e14d8b74`.
- Audit passed — diff scope from origin/main: 0 errors, 0 warnings; no config drift, no dependency violations (7 modules), no doc drift.
