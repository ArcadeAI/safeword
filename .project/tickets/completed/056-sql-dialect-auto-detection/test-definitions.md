# 056: SQL Dialect Auto-Detection — Test Definitions

## Scenario 1: Detect dialect from dbt adapter in Python deps

**Given** a project with `dbt-postgres` (or other adapter) in requirements.txt or pyproject.toml
**When** dialect detection runs
**Then** returns the correct SQLFluff dialect

- [x] Unit tests: `sql-dialect.test.ts` — postgres, snowflake, bigquery, spark→sparksql, fabric→tsql, unknown→undefined

## Scenario 2: Detect dialect from sqlc config

**Given** a project with sqlc.yaml/yml/json containing an `engine` field
**When** dialect detection runs
**Then** returns the correct SQLFluff dialect

- [x] Unit tests: `sql-dialect.test.ts` — postgresql→postgres, mysql

## Scenario 3: Detect dialect from Prisma schema

**Given** a project with `prisma/schema.prisma` containing a `provider` field
**When** dialect detection runs
**Then** returns the correct SQLFluff dialect

- [x] Unit tests: `sql-dialect.test.ts` — postgresql→postgres, mysql, sqlserver→tsql

## Scenario 4: Detect dialect from DATABASE_URL

**Given** a project with `.env` containing `DATABASE_URL` with a scheme prefix
**When** dialect detection runs
**Then** returns the correct SQLFluff dialect

- [x] Unit tests: `sql-dialect.test.ts` — postgresql→postgres, mysql, clickhouse

## Scenario 5: Priority ordering

**Given** a project with both dbt Python deps AND DATABASE_URL
**When** dialect detection runs
**Then** Python deps take priority

- [x] Unit test: `sql-dialect.test.ts` — snowflake (deps) wins over postgres (DATABASE_URL)

## Scenario 6: No signals returns undefined

**Given** a project with no dialect signals
**When** dialect detection runs
**Then** returns undefined (caller defaults to ansi)

- [x] Unit tests: `sql-dialect.test.ts` — empty project, dbt_project.yml without deps

## Scenario 7: Dialect written into generated configs

**Given** a detected dialect
**When** SQLFluff config files are generated
**Then** `dialect = {detected}` appears in both .safeword/sqlfluff.cfg and .sqlfluff

- [x] Implementation: files.ts generators pass `detectSqlDialect(ctx.cwd) ?? 'ansi'` to config generators
