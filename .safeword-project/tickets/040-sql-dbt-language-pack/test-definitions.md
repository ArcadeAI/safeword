# Test Definitions: dbt Language Pack (#040)

**Feature**: Detect dbt projects and lint `.sql` files with SQLFluff
**Test File**: `packages/cli/tests/integration/dbt-golden-path.test.ts`

---

## Suite 1: Detection

- [x] **1.1** Given a project with `dbt_project.yml`, when `safeword setup` runs, then `dbt: true` is detected in languages
- [x] **1.2** Given a project WITHOUT `dbt_project.yml`, when `safeword setup` runs, then `dbt: false` (no dbt pack installed)
- [x] **1.3** Given a project with `.sql` files but no `dbt_project.yml`, when `safeword setup` runs, then dbt pack is NOT triggered

## Suite 2: Config Generation

- [x] **2.1** Given a dbt project with no existing `.sqlfluff`, when `safeword setup` runs, then `.sqlfluff` is created at project root with `ansi` dialect and `jinja` templater
- [x] **2.2** Given a dbt project with no existing `.sqlfluff`, when `safeword setup` runs, then `.safeword/sqlfluff.cfg` is created with stricter LLM-enforcement rules
- [x] **2.3** Given a dbt project with an EXISTING `.sqlfluff`, when `safeword setup` runs, then the existing `.sqlfluff` is NOT overwritten (managed file pattern)
- [x] **2.4** Given a dbt project, when `safeword upgrade` runs, then `.safeword/sqlfluff.cfg` is updated to latest (owned file pattern)

## Suite 3: Schema & Registry

- [x] **3.1** Given the schema, then dbt config files have entries in ownedFiles and managedFiles
- [x] **3.2** Given the pack registry, then `dbt` pack is registered in LANGUAGE_PACKS
- [x] **3.3** Given a dbt project, when running `safeword setup`, then pack appears in setup output

## Suite 4: Lint Hook Integration

- [x] **4.1** Given a `.sql` file is edited in a dbt project, when the post-tool lint hook runs, then `sqlfluff fix` is called on the file
- [x] **4.2** Given sqlfluff is NOT installed, when the lint hook runs on a `.sql` file, then it skips silently (no error)
- [x] **4.3** Given a `.sql` file in a non-dbt project, when the lint hook runs, then no SQL linting occurs

## Suite 5: Upgrade & Late Detection

- [x] **5.1** Given a dbt project with safeword installed, when `safeword upgrade` runs, then owned dbt files are updated
- [x] **5.2** Given a project that ADDS `dbt_project.yml` after initial setup, when `safeword upgrade` runs, then dbt pack is detected and installed

---

## Summary

**Total**: 14 scenarios
**Passing**: 14 (100%)
**Not Implemented**: 0 (0%)

### Test Execution

```bash
bun run test -- --testNamePattern="dbt"
```

---

**Last Updated**: 2026-03-19
