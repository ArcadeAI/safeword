# Verify: WR4HRA codex-min-version-baseline

## Verify Checklist

**Test Suite:** ✓ 44/44 focused tests pass (`bun run --cwd packages/cli test tests/commands/setup-reconcile.test.ts tests/integration/codex-pretooluse-spike.test.ts tests/schema.test.ts`)
**Build:** ✅ Success (`tsup` ran as test/Cucumber prebuild)
**Lint:** ✅ Clean (`bun run lint:gherkin`; `bunx eslint packages/cli/src/commands/setup.ts packages/cli/tests/commands/setup-reconcile.test.ts packages/cli/features/steps/codex.steps.ts`)
**Typecheck:** ✅ Clean (`bun run --cwd packages/cli typecheck`)
**Scenarios:** All 1 scenarios marked complete (`bun run --cwd packages/cli test:bdd -- --tags "@codex-min-version-baseline or @codex-agents-config-generation or @codex-pretooluse-deny-spike"` passed 7 scenarios / 35 steps)
**Dep Drift:** ⏭️ Skipped — no dependency changes.
**Parent Epic:** QM5G9M
**Reconcile:** ✅ No pattern deviation

## Notes

- `codex-version` baseline is recorded as `0.133.0`.
- Setup now warns, without blocking setup, when an installed `codex --version` is below `0.133.0`.
- Missing or unparsable Codex stays silent so non-Codex users are not warned just because safeword installs Codex-compatible assets.
- A full live trusted Codex session remains out of scope and belongs to `CXP9LM`.
