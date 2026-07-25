# Verify: Close Codex tickets when evidence passes

## Verify Checklist

**Test Suite:** ✓ 5387/5392 tests pass (5 skipped)
**Gherkin:** ✅ Acceptance lane passes (494 passed, 3 skipped)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 13 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ⚠️ Dev-only ESLint 10.7.0 → 10.8.0 is a low-risk repository baseline; it is outside this ticket's Stop-lifecycle scope.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — internal workflow plumbing
**Evidence limits:** ✅ None

Audit passed with warnings: the unchanged repository-wide Knip `which` hint,
mirror-heavy duplication baseline, unavailable Python dead-code tooling, and
the ESLint patch update remain outside QRX2DN scope.

## Evidence

- `bun run --cwd packages/cli test` — 361 files, 5,387 passed, 5 skipped.
- `cucumber-js --tags 'not @wip and not @manual and not @live'` — 494 passed,
  3 skipped.
- `bun run --cwd packages/cli typecheck` — pass.
- `bun run lint` — pass.
- `bun scripts/parity-check.ts --mode=all` — 193 pairs and 8 contracts in sync.
- `bun run test tests/integration/codex-stop-retro.test.ts` — 31 passed.

## Hook-lifecycle limitation

This Codex harness does not dispatch its tool calls through project PostToolUse
and Stop hooks. The Desktop fallback is proven by the real adapter integration
test, but this ticket has not been synthetically bound or self-closed; a genuine
Codex hook lifecycle (or PR CI plus a normal Desktop session) must perform that
final transition.
