# Verify: R6ARF5 monitor detection skeleton

## Result

Done. The scheduled workflow now runs a read-only monitor that compares committed snapshots to live upstream content and opens or updates one issue per changed source.

## Evidence

- `.github/workflows/upstream-changelog-monitor.yml` uses an off-:00 weekly cron plus `workflow_dispatch`.
- Workflow permissions are `contents: read` and `issues: write`.
- `packages/cli/src/upstream-monitor/run.ts` invokes the monitor with `GITHUB_TOKEN` and does not write snapshots.
- `packages/cli/src/upstream-monitor/index.ts` reports changed sources through idempotent issue create/update behavior.

Focused tests:

```sh
SAFEWORD_TEST_LOCK_DIR=/Users/alex/.codex/worktrees/monitor-source-adapters/.test-lock bun run --cwd packages/cli test tests/upstream-monitor/sources.test.ts tests/upstream-monitor/issues.test.ts
```

Result:

```text
Test Files  2 passed (2)
Tests       5 passed (5)
```
