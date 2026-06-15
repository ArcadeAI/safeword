# Verify: 71Q4DV eslint-10-react-plugin-path

## Verify Checklist

**Focused React tests:** Pass. `bun run test src/presets/typescript/eslint-configs/__tests__/react.test.ts` passed 32/32 tests after the quality-review follow-up and refactor pass.
**Related preset tests:** Pass. `bun run test src/presets/typescript/eslint-configs/__tests__/react.test.ts src/presets/typescript/eslint-configs/__tests__/nextjs.test.ts src/presets/typescript/eslint-configs/__tests__/configs.test.ts tests/schema.test.ts` passed 105/105 tests after the quality-review follow-up.
**Smoke tests:** Pass. `bun run test:smoke:fast` passed 482/482 tests.
**BDD:** Pass. `bun run test:bdd` passed 25 scenarios and 162 steps.
**Build:** Pass. `bun run build` completed successfully.
**Typecheck:** Pass. `bun run typecheck` completed successfully in `packages/cli`.
**ESLint:** Pass. `bun run lint:eslint` completed successfully.
**Gherkin lint:** Pass. `bun run lint:gherkin` completed successfully.
**Markdown lint:** Pass. `bun run lint:md` reported 0 errors.
**Format:** Pass. `bun run format:check` reported all matched files use Prettier style.
**Dep drift:** Review needed. `bun run knip` still reports the existing project-wide unused/unlisted dependency baseline; it did not flag the new `@eslint-react/eslint-plugin` dependency or the `eslint-v10` alias added for compatibility testing.
**Full suite:** Pass. `TEST_POETRY=1 bun run --cwd packages/cli test` completed with 198 test files and 2923 tests passed in 1662.58s; it emitted the existing `Ambiguous ticket ID "7K9M3P"` warning tracked by `7VEYAY`.
**Config sync/deps:** Pass with published-CLI caveat. `bun packages/cli/src/cli.ts sync-config --check` passed, and `bun run deps` passed. `bunx safeword@latest sync-config --check` still reports stale `.safeword/depcruise-config.cjs`, which is published-version drift rather than branch-local generated-config drift and is tracked by `BYXB03`.

## Done-When Verification

- `packages/cli/package.json` now depends on `@eslint-react/eslint-plugin` and no longer depends on `eslint-plugin-react`.
- `@eslint-react/eslint-plugin` is exact-pinned at `5.9.0` because `@eslint-react/no-duplicate-key` is an accepted experimental guardrail replacement.
- `packages/cli/src/presets/typescript/eslint-configs/recommended-react.ts` imports `@eslint-react/eslint-plugin`, applies its recommended TypeScript config, disables conflicts with the official Hooks plugin, and keeps `eslint-plugin-react-hooks`.
- The React preset explicitly sets the load-bearing replacement rules to `error`: missing keys, duplicate keys, direct state mutation, children prop usage, unsafe target blank links, and unknown DOM properties.
- The React preset disables overlapping `@eslint-react` hook/compiler diagnostics so `eslint-plugin-react-hooks` remains the only Hooks/Compiler source.
- The React preset normalizes inherited React-family warnings to `error`, with a regression test proving no `@eslint-react`, `react-hooks`, or `jsx-a11y` rule resolves to `warn`.
- ESLint 10 compatibility is covered with the `eslint-v10` npm alias and a focused config-load/lint test.
- The future production ESLint 10 runtime floor is tracked in `../099-eslint-10-migration/ticket.md`; current code intentionally leaves Safeword's `engines.node` at `>=22.12` until ticket 099 expands the production ESLint peer.
- Parity gaps for duplicate JSX props and unescaped entities are documented as Safeword custom-rule follow-ups if those old-plugin-only checks remain required.
- `ARCHITECTURE.md` now documents `@eslint-react/eslint-plugin` as the React framework plugin and records that legacy `eslint-plugin-react` is intentionally not bundled.
