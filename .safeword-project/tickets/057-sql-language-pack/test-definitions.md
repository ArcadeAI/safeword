# 057: SQL Language Pack — Test Definitions

## Scenario 1: Tier 1 config file markers activate SQL pack

**Given** a project with a SQL tool config file (dbt_project.yml, .sqlfluff, sqlc.yaml, sqlc.yml, sqlc.json, flyway.toml, flyway.conf, atlas.hcl, liquibase.properties, schemachange-config.yml)
**When** language detection runs
**Then** `languages.sql` is `true`

- [x] Unit tests: `shallow-detection.test.ts` — 10 parameterized tests via `it.each`

## Scenario 2: Tier 2 directory conventions activate SQL pack

**Given** a project with a known SQL directory containing .sql files (prisma/migrations/, drizzle/, db/migrations/)
**When** language detection runs
**Then** `languages.sql` is `true`

- [x] Unit tests: `shallow-detection.test.ts` — 3 tests (Prisma with subdirs, Drizzle, db/migrations)

## Scenario 3: Tier 2 directory without .sql files does NOT activate

**Given** a project with a Tier 2 directory that contains no .sql files
**When** language detection runs
**Then** `languages.sql` is `false`

- [x] Unit test: `shallow-detection.test.ts` — empty drizzle/ directory

## Scenario 4: Empty project does NOT activate SQL pack

**Given** a project with no SQL markers
**When** language detection runs
**Then** `languages.sql` is `false`

- [x] Unit test: `shallow-detection.test.ts` — empty project

## Scenario 5: Bare migrations directory does NOT activate

**Given** a project with .sql files in a generic `migrations/` directory (not a recognized convention)
**When** language detection runs
**Then** `languages.sql` is `false`

- [x] Unit test: `shallow-detection.test.ts` — bare migrations/ directory

## Scenario 6: Pack rename dbt → sql

**Given** an existing project with `"dbt"` in `installedPacks`
**When** upgrade runs
**Then** `installedPacks` contains `"sql"` instead of `"dbt"`

- [x] Implementation: `migratePackId()` in config.ts, called from upgrade.ts

## Scenario 7: dbt golden path still works after rename

**Given** a dbt project with dbt_project.yml
**When** `safeword setup` runs
**Then** SQL pack detected, .sqlfluff and .safeword/sqlfluff.cfg created

- [x] E2E test: `sql-golden-path.test.ts` — test 1.1
