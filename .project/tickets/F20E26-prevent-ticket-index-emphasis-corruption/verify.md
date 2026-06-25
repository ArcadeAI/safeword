# Verify — Prevent ticket index emphasis corruption

## Verify Checklist

**Test Suite:** ✅ Clean full suite passes: 3631 passed, 3 skipped
**Gherkin:** ✅ Acceptance lane passes
**Build:** ⏭️ Skipped — no build step
**Lint:** ✅ Clean
**Scenarios:** ⏭️ Skipped — no test-definitions.md for task ticket
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — internal generated-index resilience

## Evidence

- `/verify` invocation proof logged: `[skill-invocation-log] verify ✓`.
- `bun run lint:eslint` passed.
- `bun run format --if-present` ran Prettier across the repo; all files were unchanged. Bun passed `--if-present` through to Prettier, which warned that it ignored the unknown option.
- `bun run lint` passed (`eslint .`, `lint-gherkin`, and `packages/cli typecheck`).
- `bun run --cwd packages/cli test tests/ticket-sync/ticket-sync.test.ts` passed: 26/26 ticket-sync tests.
- Forced Prettier on copies of `.project/tickets/INDEX.md` and `INDEX-completed.md` produced no diff after the fix.
- PostTool lint hook against the real generated `INDEX.md` produced no diff.
- `bun run test:bdd` passed: 154 scenarios, 2591 steps.
- `bun packages/cli/src/cli.ts check` passed configuration health and index consistency; it reported the pre-existing project-config upgrade notice from v0.55.0 to v0.56.0.
- After clearing stale external safeword runners and safeword temp fixtures, `bun run test` passed cleanly: 248 test files passed; 3631 tests passed, 3 skipped.

## Full Suite Note

An earlier full-suite run was polluted by concurrent safeword test runs in other worktrees and failed one concurrency-sensitive lock assertion:

- 247 test files passed, 1 failed.
- 3630 tests passed, 3 skipped, 1 failed.
- Failed test: `tests/test-runner-lock.test.ts > serializes build and vitest for concurrent focused test commands`.
- Failure detail: the assertion expected empty stderr, but the spawned command printed `Waiting for another safeword package test run to finish...`.

This matched the observed environment: other safeword Vitest runs were active in separate worktrees during the full run. Rerunning only the failed file after the full run passed: 1/1 tests.

The clean rerun after clearing those external runners passed:

- 248 test files passed.
- 3631 tests passed, 3 skipped.
- Duration: 922.09s.
