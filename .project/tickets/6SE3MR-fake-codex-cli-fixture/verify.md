# Verify: Share fake Codex CLI fixtures where it pays off

## Decision

No code change. The duplication is intentionally kept.

Current duplicated behavior:

- `packages/cli/features/steps/codex.steps.ts` writes a temporary `codex` shell stub for Cucumber scenarios.
- `packages/cli/tests/helpers.ts` exports `installFakeCodexCli()` for Vitest setup/upgrade tests.

The duplicated body is only the two-line executable:

```sh
#!/usr/bin/env sh
echo "codex <version>"
```

Extracting that would either make Cucumber steps import Vitest-only helpers or create a production-adjacent fixture module for a tiny test stub. That is more coupling than the duplication is worth.

## Evidence

```sh
bun run --cwd packages/cli test:bdd -- --tags @codex-min-version-baseline
```

Result:

```text
2 scenarios (2 passed)
10 steps (10 passed)
```

```sh
SAFEWORD_TEST_LOCK_DIR=/Users/alex/.codex/worktrees/revalidate-codex-active/.test-lock bun run --cwd packages/cli test tests/commands/setup-reconcile.test.ts tests/commands/upgrade-reconcile.test.ts
```

Result:

```text
Test Files  2 passed (2)
Tests       32 passed (32)
```

## Verdict

Done. The ticket allowed either a small shared fake Codex binary fixture or a recorded decision to keep the duplication. The recorded decision is lower risk and verified.
