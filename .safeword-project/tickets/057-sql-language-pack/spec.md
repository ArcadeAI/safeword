# 057: SQL Language Pack Spec

## Problem

The dbt language pack (ticket 040) only activates when `dbt_project.yml` exists. This misses a significant population of SQL authors:

- **Flyway / Liquibase / Atlas / golang-migrate / dbmate** — hand-written `.sql` migration files
- **sqlc** — hand-written `.sql` query files that generate Go code
- **Prisma / Drizzle** — auto-generated `.sql` migration files that are designed to be hand-edited
- **Airflow / plain ETL** — `.sql` scripts for data pipelines
- **Stored procedures** — `.sql` files in SQL Server / PostgreSQL projects

~20-40% of SQLFluff users are not dbt users (based on PyPI download ratios: sqlfluff ~8.7M/mo vs sqlfluff-templater-dbt ~3.1M/mo). The templater is a non-issue: `templater = jinja` passes through plain SQL unchanged, so a single config works for both dbt and non-dbt SQL.

## Design: Rename dbt → sql, Broaden Activation

### Pack identity

- **ID:** `sql` (was `dbt`)
- **Name:** `SQL`
- **Extensions:** `['.sql']`
- **Config files:** `.safeword/sqlfluff.cfg` (owned), `.sqlfluff` (managed) — unchanged
- **Templater:** `jinja` with `apply_dbt_builtins = True` — works for both dbt and plain SQL

### Activation: tiered signal detection

`detect(cwd)` returns `true` if any Tier 1 or Tier 2 signal is found.

#### Tier 1 — Config file markers (high confidence)

These files unambiguously indicate a SQL-focused project:

| Signal                                 | Tool         | Notes                                                            |
| -------------------------------------- | ------------ | ---------------------------------------------------------------- |
| `dbt_project.yml`                      | dbt          | Existing detection                                               |
| `.sqlfluff`                            | User opt-in  | User explicitly wants SQL linting                                |
| `sqlc.yaml` / `sqlc.yml` / `sqlc.json` | sqlc         | Go SQL codegen, always has `.sql` queries                        |
| `flyway.toml` / `flyway.conf`          | Flyway       | `.toml` is primary since v10; `.conf` deprecated but still works |
| `atlas.hcl`                            | Atlas        | Always has `.sql` migration files                                |
| `liquibase.properties`                 | Liquibase    | Often has `.sql` changesets                                      |
| `schemachange-config.yml`              | schemachange | Snowflake `.sql` migrations                                      |

Detection: `existsShallow(cwd, marker)` for each — same pattern as all other packs.

#### Tier 2 — Directory conventions with `.sql` file presence (good confidence)

These directories are strong signals when they contain `.sql` files:

| Signal                                      | Tool / Convention | Notes                                                                  |
| ------------------------------------------- | ----------------- | ---------------------------------------------------------------------- |
| `prisma/migrations/` with `*.sql`           | Prisma            | Migrations always present; TypedSQL (preview) adds hand-written `.sql` |
| `drizzle/` with `*.sql`                     | Drizzle ORM       | Migrations always `.sql`                                               |
| Paired `*.up.sql` / `*.down.sql` in any dir | golang-migrate    | No config file, convention only                                        |
| `db/migrations/` with `*.sql`               | dbmate, generic   | Common convention                                                      |

Detection: check directory exists AND contains at least one `.sql` file.

#### Not detected (intentionally excluded)

| Signal                     | Why excluded                                               |
| -------------------------- | ---------------------------------------------------------- |
| Bare `sql/` directory      | Too generic — could be test fixtures, seed data, anything  |
| Knex / Sequelize / TypeORM | SQL in JS/TS strings, not `.sql` files                     |
| Django / Rails / Alembic   | SQL in Python/Ruby, not `.sql` files                       |
| Any `.sql` file anywhere   | Too noisy — would activate on `node_modules`, vendor, etc. |

### Fallback: `ansi` dialect

When the pack activates but no dialect can be detected, use `dialect = ansi`. Style rules (capitalisation, indentation, line length) work on all SQL. Parse errors on dialect-specific syntax are informative — SQLFluff warns "Have you configured your dialect?" which guides the user to the fix. See [056 spec](../056-sql-dialect-auto-detection/spec.md) for full dialect detection design.

---

## Dialect Detection (child ticket 056)

Dialect detection is spec'd in [056-sql-dialect-auto-detection](../056-sql-dialect-auto-detection/spec.md). Summary of signal sources:

**For dbt projects:**

1. `profiles.yml` → `type` field
2. Python deps → `dbt-{adapter}` packages

**For non-dbt projects** (new, added by this ticket): 3. `prisma/schema.prisma` → `provider` field (e.g., `"postgresql"`) 4. `drizzle.config.ts` → `dialect` field (e.g., `"postgresql"`) 5. `DATABASE_URL` in `.env` → scheme prefix (e.g., `postgres://`)

Only Prisma and Drizzle are included because they're the only ORMs that produce `.sql` files. Knex/Sequelize/TypeORM/Django/Rails embed SQL in host-language strings — detecting their dialect doesn't help lint `.sql` files.

These signals fold into the `detectSqlDialect(cwd)` function from 056.

---

## Pack Migration: dbt → sql

### Config migration

Existing projects have `"dbt"` in `.safeword/config.json` `installedPacks` array. Add a one-time migration to the upgrade command:

```typescript
// In upgrade.ts, before pack detection
const config = readConfig(cwd);
if (config.installedPacks.includes('dbt') && !config.installedPacks.includes('sql')) {
  config.installedPacks = config.installedPacks.map(p => (p === 'dbt' ? 'sql' : p));
  writeConfig(cwd, config);
}
```

### File changes

| File                                        | Change                                                  |
| ------------------------------------------- | ------------------------------------------------------- |
| `packages/cli/src/packs/dbt/`               | Rename directory → `packs/sql/`                         |
| `packs/sql/index.ts`                        | `id: 'sql'`, `name: 'SQL'`, broaden `detect()`          |
| `packs/sql/files.ts`                        | Rename exports: `dbtOwnedFiles` → `sqlOwnedFiles`, etc. |
| `packs/sql/setup.ts`                        | Add `detectSqlDialect()` (from 056)                     |
| `packs/registry.ts`                         | `sql: sqlPack` (was `dbt: dbtPack`)                     |
| `schema.ts`                                 | Update imports and spreads                              |
| `commands/upgrade.ts`                       | `installSqlTools()`, pack ID migration                  |
| `utils/project-detector.ts`                 | `Languages.sql` (was `.dbt`), broaden detection         |
| `tests/integration/dbt-golden-path.test.ts` | Rename → `sql-golden-path.test.ts`, update assertions   |
| `tests/utils/shallow-detection.test.ts`     | Update `languages.sql` assertions                       |

**Total blast radius:** ~10 files + 1 directory rename. All mechanical renames except the broadened `detect()` function.

---

## Implementation Plan

### Phase 1: Rename (no behavior change)

1. Rename `packs/dbt/` → `packs/sql/`
2. Update all references (`dbt` → `sql` in IDs, exports, imports)
3. Add config migration in upgrade.ts
4. Rename and update tests
5. Verify: existing dbt projects still work identically after upgrade

### Phase 2: Broaden activation (056 + new signals)

1. Implement `detectSqlDialect()` from 056 spec (profiles.yml + Python deps)
2. Add Tier 1 config file detection to `detect()`
3. Add Tier 2 directory convention detection
4. Add Prisma/Drizzle dialect detection
5. Add DATABASE_URL dialect detection
6. Update golden path tests for non-dbt activation
7. Add new integration tests for Flyway, sqlc, Prisma activation

### Phase 3: Verify

1. Existing dbt projects: still detected, correct dialect, config migrated
2. Flyway project: detected, linted with ansi (or dialect from DATABASE_URL)
3. sqlc project: detected, linted
4. Prisma project: detected, dialect from schema.prisma
5. No-signal project: not detected, no SQL linting

---

## Tests

| Test                                                  | What it verifies                        |
| ----------------------------------------------------- | --------------------------------------- |
| **Migration**                                         |                                         |
| Config migration: dbt → sql                           | `installedPacks` updated on upgrade     |
| Config migration: idempotent                          | Running upgrade twice doesn't duplicate |
| **Tier 1 activation**                                 |                                         |
| dbt_project.yml activates pack                        | Backward compat                         |
| sqlc.yaml activates pack                              | New signal                              |
| flyway.conf activates pack                            | New signal                              |
| atlas.hcl activates pack                              | New signal                              |
| .sqlfluff activates pack                              | User opt-in                             |
| **Tier 2 activation**                                 |                                         |
| prisma/migrations/ with .sql activates                | Directory + file presence               |
| drizzle/ with .sql activates                          | Directory + file presence               |
| paired .up.sql/.down.sql activates                    | golang-migrate convention               |
| **Negative cases**                                    |                                         |
| Empty project: pack not activated                     | No false positives                      |
| Project with only .sql in node_modules: not activated | Noise filtering                         |
| Knex project without .sql files: not activated        | ORM without SQL files                   |
| **Dialect (from 056)**                                |                                         |
| dbt profiles.yml → correct dialect                    | Existing                                |
| dbt Python deps → correct dialect                     | New                                     |
| Prisma schema → correct dialect                       | New                                     |
| Drizzle config → correct dialect                      | New                                     |
| DATABASE_URL → correct dialect                        | New                                     |
| No signals → ansi default                             | Fallback                                |
| **End-to-end**                                        |                                         |
| dbt project: setup → config → lint → correct dialect  | Full flow                               |
| Flyway project: setup → config → lint → ansi          | Full flow                               |
| Prisma project: setup → config → lint → postgres      | Full flow                               |

---

## What This Does NOT Cover

- **SQL-in-strings linting** — Extracting and linting SQL embedded in JS/TS/Python/Ruby strings. Different problem, different tool. Out of scope.
- **Migration safety linting** — Tools like Squawk catch dangerous DDL (missing `CONCURRENTLY`, unsafe `ALTER`). Complementary to style linting but separate. Potential future `/sql-audit` command.
- **Multiple templaters** — SQLFluff doesn't support per-directory templater overrides. Since `templater = jinja` works on plain SQL, this is a non-issue for now. If a project needs `templater = dbt` for full macro resolution, they can set that in their own `.sqlfluff`.
- **Auto-installing SQLFluff** — Python dependency management is messy. Print install instructions, skip linting if not installed. Same as current behavior.

---

## Design Decisions Log

### Why rename instead of adding a second pack?

Two packs (`dbt` + `sql`) would both want to own `.sqlfluff` and `.safeword/sqlfluff.cfg`. Config file conflicts are hard to resolve. A single `sql` pack that handles both dbt and non-dbt SQL is simpler. The dbt-specific config (`apply_dbt_builtins = True`) is harmless on non-dbt SQL (jinja templater ignores files with no Jinja syntax).

### Why not activate on any `.sql` file?

`.sql` files exist in many contexts that don't benefit from linting: test fixtures, seed data, ORM-generated files, `node_modules`. Activating broadly would be noisy and confusing. Tier 1 (config markers) and Tier 2 (directory conventions) target projects with intentional SQL work.

### Why include `apply_dbt_builtins = True` for non-dbt projects?

It's harmless. When a plain SQL file has no `{{ ref() }}` or `{{ source() }}` calls, the jinja templater passes it through unchanged. The builtins are never invoked. Including it means dbt projects work without separate config.

### Why only Prisma and Drizzle for ORM dialect detection?

Research showed that only 2 of 7 major ORMs produce `.sql` files: Prisma (migrations + TypedSQL) and Drizzle (migrations). Knex, Sequelize, TypeORM, Django, and Rails embed SQL in host-language strings. Detecting their dialect doesn't help lint `.sql` files that don't exist.

### Why include DATABASE_URL detection?

It's 5 lines of code and covers the "plain SQL scripts with no ORM" case — Flyway projects, Airflow SQL, raw ETL scripts. These projects often have a `.env` with `DATABASE_URL` but no ORM config to read. Parsing only the scheme prefix (`postgres://`) keeps it safe — credentials are never read or stored.
