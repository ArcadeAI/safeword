# Verification

**PR Scope:** PR #3507 changes the manual retro carrier, dependency-readiness recovery boundary, generated plugin mirrors, and their tests/acceptance contract for issue #3506.

## Acceptance

- `features/safeword-recovery-through-dependency-readiness.feature`: 38 scenarios, 1,712 steps passed.
- A pinned `bunx --bun safeword@<version> retro run` bypasses stale project dependencies.
- An unversioned carrier and ordinary dependency-backed commands remain guarded.
- A successful later install clears the effect of durable failed-install state.

## Automated evidence

- Readiness and public-retro integration: 193 tests passed.
- Generated Claude plugin integrity: 49 tests passed.
- Lifecycle, install-plan, and machine contracts: 75 tests passed.
- Full package run: relay 186 passed / 1 skipped; collector 106 passed; CLI 8,717 passed / 13 skipped with one unrelated closeout receipt test timing out at 30 seconds.
- The timed-out closeout receipt test passed immediately in isolation (1 passed / 26 skipped).
- Build: passed for relay, collector, and CLI.
- Typecheck: passed for relay, collector, and CLI.
- Lint, Gherkin lint, and `git diff --check`: passed.

## Review

- Audit passed for the changed readiness and retro-delivery boundary.
- Refactor review found no warranted structural change; the implementation remains a narrow classifier, guidance, and readiness-order fix.
