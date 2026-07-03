# Verify: Let maintainers commit dogfood hook changes without package-link setup

## Verify Checklist

**Test Suite:** ✓ 135/135 focused tests pass (`dogfood-source-worktree.test.ts`, `config.test.ts`, `schema.test.ts`, `reconcile.test.ts`)
**Gherkin:** ✅ Acceptance lane passes with 181/181 scenarios and 3414/3414 steps.
**Build:** ✅ Success (`bun run --cwd packages/cli build`)
**Lint:** ✅ Clean (focused ESLint on changed TypeScript files + `tsc --noEmit`)
**Scenarios:** All 2 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — internal dogfood commit-path plumbing, not persona-facing
**Evidence limits:** ✅ None

## Evidence

- `node --input-type=module ... import('safeword/eslint')`
- `bunx eslint --config .safeword/eslint.config.mjs packages/cli/tests/integration/review-stamp.test.ts`
- `bunx eslint --config eslint.config.ts .safeword/hooks/lib/lint.ts --no-warn-ignored`
- `bun run --cwd packages/cli test tests/dogfood-source-worktree.test.ts src/templates/config.test.ts`
- `bun run --cwd packages/cli test tests/reconcile.test.ts tests/schema.test.ts src/templates/config.test.ts tests/dogfood-source-worktree.test.ts`
- `bunx eslint --config eslint.config.ts packages/cli/src/templates/config.ts packages/cli/src/templates/config.test.ts packages/cli/tests/dogfood-source-worktree.test.ts`
- `bun run --cwd packages/cli typecheck`
- `bun run test:bdd`
- `bun run --cwd packages/cli build`
- `git diff --check`
