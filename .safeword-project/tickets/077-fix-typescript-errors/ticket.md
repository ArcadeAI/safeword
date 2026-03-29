# Task: Fix TypeScript errors from SQL pack additions

**Type:** Bug

**Scope:** Fix ~60 TypeScript errors across 5 files caused by `existingSqlfluffConfig` being added to `ProjectType` without updating test fixtures and by missing type narrowing in SQL-related code.

**Out of Scope:** CI workflow changes (ticket 076), new tests, refactoring existing type structures.

**Done When:**

- [ ] `bun run --cwd packages/cli typecheck` passes
- [ ] `bun run --cwd packages/cli test` passes
- [ ] CI lint job typecheck step passes

**Tests:**

- [ ] Existing tests pass (no new tests needed — these are type errors, not logic bugs)

## Files

- `packages/cli/tests/reconcile.test.ts` — add `existingSqlfluffConfig` to ~50 `ProjectType` fixtures
- `packages/cli/src/commands/setup.ts` — add missing `sql` property to `Languages` fallback literals (4 errors)
- `packages/cli/src/packs/rust/files.ts` — narrow `string | undefined` to `string` (1 error)
- `packages/cli/src/packs/sql/dialect.ts` — guard against `undefined` index access (5 errors)
- `packages/cli/tests/integration/sql-golden-path.test.ts` — guard `LANGUAGE_PACKS.sql` possibly-undefined (2 errors)

## Work Log

- 2026-03-29 Created. Split from ticket 076. Errors introduced when SQL pack added `existingSqlfluffConfig` to `ProjectType` interface without propagating to test fixtures. CI typecheck has been failing since those commits.
