# 056: SQL Dialect Auto-Detection Spec

## Problem

The dbt language pack (ticket 040) hardcodes `dialect = ansi` in both `.safeword/sqlfluff.cfg` and the managed `.sqlfluff`. This causes problems for dialect-specific SQL:

- `ansi` rejects valid syntax like `::int` casting (Postgres), `ILIKE` (Postgres/Snowflake), `FLATTEN` (Snowflake), `SAFE_DIVIDE` (BigQuery), dollar-quoted strings, etc.
- SQLFluff emits parse errors (`PRS`) on unrecognised syntax — these block auto-fix and confuse Claude
- For basic SQL (SELECT, JOIN, WHERE, GROUP BY) without dialect-specific syntax, `ansi` works fine with near-zero false positives

Since safeword is set up by Claude Code (zero config), the pack should detect the correct dialect automatically when the signals are available.

## Scope

**In scope:** Detecting dialect from all project signals — dbt profiles/deps (Priority 1-2), sqlc config (Priority 3), ORM configs like Prisma and Drizzle (Priority 4), and DATABASE_URL in `.env` (Priority 5). Originally scoped to dbt-only, expanded when ticket 057 broadened the SQL pack to non-dbt projects.

---

## Design: Detect at Setup/Upgrade Time

### Single detection point

`detectSqlDialect(cwd)` runs during config generation at setup/upgrade time. Writes the detected dialect into `.safeword/sqlfluff.cfg` and the managed `.sqlfluff`.

No lint hook re-detection. The existing `ensurePackInstalled` auto-upgrade pattern already triggers `safeword upgrade` when configs are missing, which re-runs detection. Running a full `bunx safeword@latest upgrade` mid-lint just for dialect staleness is too expensive for the benefit.

### Fallback when unknown

When no dialect can be detected:

- **Keep `dialect = ansi`.** For basic SQL, ansi works. For dialect-specific syntax, it produces parse errors — but these are informative (SQLFluff warns: "Parsing errors found and dialect is set to 'ansi'. Have you configured your dialect?").
- The stop hook quality review still fires on SQL edits — Claude judges data modeling, query correctness, and dbt patterns using its own domain knowledge.
- Once the user adds `profiles.yml` or installs a dbt adapter, the next `safeword upgrade` detects and writes the correct dialect.

### Three pack states

1. **Dialect detected** → run sqlfluff with correct dialect (full value)
2. **No dialect detected** → run sqlfluff with `ansi` (style rules work; parse errors on dialect-specific syntax are informative, not silent)
3. **User has existing `.sqlfluff`** → respect it, never overwrite

---

## Signal Sources (Priority Order)

Detection stops at the first match. All signals are dbt-specific — this matches the pack's activation gate (`dbt_project.yml` required).

### Priority 1: Existing `.sqlfluff` config

If the user already has a `.sqlfluff` with `dialect = <something>` set, use that. Never overwrite user config. This is already handled by the managed file system (`existingSqlfluffConfig` check).

### Priority 2: dbt `profiles.yml` → `type` field

The canonical source of adapter type for dbt projects. The `type` field is **required** in every dbt profile output.

**Resolution order** (safeword-specific, covers common project layouts):

1. `./profiles.yml` (project root — matches dbt's cwd resolution)
2. `./dbt/profiles.yml` (monorepo heuristic — dbt often lives in a subdirectory)
3. `~/.dbt/profiles.yml` (global default — dbt's standard fallback)

Note: dbt's own resolution is `--profiles-dir` flag → `DBT_PROFILES_DIR` env → cwd → `~/.dbt/`. We skip the CLI/env overrides since we're reading config at rest, not invoking dbt.

**Reading the type:**

1. Read `dbt_project.yml` → get `profile` key (e.g., `profile: 'my_project'`)
2. Find `profiles.yml` using resolution order above
3. Parse YAML → find the profile name → read `outputs.<target>.type`
4. Use the `target` key to pick the default output, or just take the first output's type

**Known limitation: `~/.dbt/profiles.yml` multi-project problem.** Global profiles.yml contains profiles for ALL dbt projects on the machine. We MUST match the profile name from `dbt_project.yml` against the top-level key in profiles.yml — do not scan all `type:` values indiscriminately or we'll pick up types from unrelated projects.

**Known limitation: profiles.yml often gitignored.** Many teams keep `profiles.yml` in `~/.dbt/` and gitignore it because it contains credentials. The global fallback helps, but in CI or fresh clones the file may not exist. This is why Priority 3 exists.

### Priority 3: Python dependencies → `dbt-{adapter}` packages

dbt adapters are installed as Python packages (`dbt-postgres`, `dbt-snowflake`, `dbt-bigquery`, etc.). These are almost always declared in the project's Python dependency files and are always in the repo (unlike `profiles.yml`).

**Check in order:**

1. `requirements.txt` — match lines starting with `dbt-` (e.g., `dbt-postgres==1.8.0`)
2. `pyproject.toml` — match dependency strings containing `dbt-` under `[project.dependencies]`, `[tool.poetry.dependencies]`, or `[tool.uv.dependencies]`

**Extraction:** Match the adapter name from the package: `dbt-{adapter}` → `{adapter}`. Then look up the mapping table below.

**Why this is strong for dbt:** Unlike `profiles.yml`, dependency files are version-controlled, don't contain credentials, and exist from project creation. A project with `dbt-snowflake` in `requirements.txt` is definitively targeting Snowflake.

### Priority 4: ORM config files (non-dbt projects)

Added by parent ticket [057-sql-language-pack](../057-sql-language-pack/spec.md). Only ORMs that produce `.sql` files:

| File                   | Field                            | Example values                                                        | SQLFluff dialect                                  |
| ---------------------- | -------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------- |
| `prisma/schema.prisma` | `provider` in `datasource` block | `"postgresql"`, `"mysql"`, `"sqlite"`, `"sqlserver"`, `"cockroachdb"` | `postgres`, `mysql`, `sqlite`, `tsql`, `postgres` |
| `drizzle.config.ts`    | `dialect` property               | `"postgresql"`, `"mysql"`, `"sqlite"`, `"mssql"`, `"cockroach"`       | `postgres`, `mysql`, `sqlite`, `tsql`, `postgres` |

Detection: regex match on data format (Prisma schema) or simple pattern match on TypeScript config. Keep it simple — `provider\s*=\s*"(\w+)"` for Prisma, `dialect:\s*["'](\w+)["']` for Drizzle.

### Priority 5: sqlc config → `engine` field

sqlc projects declare the database engine per query set. The `engine` field is **required** and has exactly three values:

| `engine` value | SQLFluff `dialect` |
| -------------- | ------------------ |
| `postgresql`   | `postgres`         |
| `mysql`        | `mysql`            |
| `sqlite`       | `sqlite`           |

**Check:** Read `sqlc.yaml` / `sqlc.yml` / `sqlc.json` → extract `engine` from the first `sql` entry. YAML/JSON parsing needed (already available via the `yaml` package used elsewhere).

### Priority 6: `DATABASE_URL` in `.env`

Parse only the scheme prefix. Do not read connection credentials.

| URL scheme               | SQLFluff `dialect` |
| ------------------------ | ------------------ |
| `postgresql`, `postgres` | `postgres`         |
| `mysql`, `mariadb`       | `mysql`            |
| `sqlite`                 | `sqlite`           |
| `clickhouse`             | `clickhouse`       |
| `redshift`               | `redshift`         |
| `snowflake`              | `snowflake`        |
| `sqlserver`, `mssql`     | `tsql`             |

Implementation: Read `.env` line by line, find `DATABASE_URL=`, extract everything before `://`. Discard the rest immediately.

### Priority 7: No signals

Return `undefined`. Config generators use `ansi` as the default dialect.

---

## Dialect Mapping Table

### dbt adapter name → SQLFluff `dialect`

The adapter name comes from either `profiles.yml` `type` field or the `dbt-{adapter}` Python package name. Most are 1:1.

| Adapter name  | SQLFluff `dialect` | Notes                 |
| ------------- | ------------------ | --------------------- |
| `postgres`    | `postgres`         |                       |
| `redshift`    | `redshift`         |                       |
| `snowflake`   | `snowflake`        |                       |
| `bigquery`    | `bigquery`         |                       |
| `clickhouse`  | `clickhouse`       |                       |
| `duckdb`      | `duckdb`           |                       |
| `trino`       | `trino`            |                       |
| `databricks`  | `databricks`       |                       |
| `athena`      | `athena`           |                       |
| `teradata`    | `teradata`         |                       |
| `materialize` | `materialize`      |                       |
| `sqlite`      | `sqlite`           |                       |
| `mysql`       | `mysql`            |                       |
| `oracle`      | `oracle`           |                       |
| `vertica`     | `vertica`          |                       |
| `starrocks`   | `starrocks`        |                       |
| `doris`       | `doris`            |                       |
| `hive`        | `hive`             |                       |
| `impala`      | `impala`           |                       |
| `db2`         | `db2`              |                       |
| `greenplum`   | `greenplum`        |                       |
| `exasol`      | `exasol`           |                       |
| **`spark`**   | **`sparksql`**     | Name mismatch         |
| **`fabric`**  | **`tsql`**         | Microsoft SQL family  |
| **`synapse`** | **`tsql`**         | Microsoft SQL family  |
| `tidb`        | `mysql`            | MySQL-compatible      |
| `singlestore` | `mysql`            | MySQL-compatible      |
| `cratedb`     | `postgres`         | PostgreSQL-compatible |
| `timescaledb` | `postgres`         | PostgreSQL extension  |

Adapters without a SQLFluff dialect (`firebolt`, `rockset`, `mindsdb`, `dremio`, `risingwave`, `databend`, `maxcompute`) → return `undefined` → fall through to `ansi` default.

Unknown adapter names not in this table → also return `undefined` → `ansi` default. This is safe because `ansi` handles basic SQL, and the stop hook provides quality review for everything else.

---

## Implementation Plan

### 1. `detectSqlDialect(cwd)` in `packs/dbt/setup.ts`

New function that implements the signal priority chain. Returns `string | undefined`.

```typescript
export function detectSqlDialect(cwd: string): string | undefined {
  // Priority 2: dbt profiles.yml
  const profilesDialect = detectFromProfiles(cwd);
  if (profilesDialect) return profilesDialect;

  // Priority 3: Python deps (dbt-{adapter} packages)
  const depsDialect = detectFromPythonDeps(cwd);
  if (depsDialect) return depsDialect;

  // Priority 4: No signals
  return undefined;
}
```

Each `detect*` function is small and pure — reads files, matches patterns, looks up the mapping table.

`detectFromProfiles(cwd)`:

1. Read `dbt_project.yml` → extract `profile:` value
2. Search for `profiles.yml` in resolution order
3. Parse YAML → match profile name → read `type` from default target
4. Map through adapter→dialect table

`detectFromPythonDeps(cwd)`:

1. Check `requirements.txt` → regex match `^dbt-(\w+)`
2. Check `pyproject.toml` → regex match `dbt-(\w+)` in dependency sections
3. Map through adapter→dialect table

### 2. Update config generators in `packs/dbt/files.ts`

Pass detected dialect into `generateSqlfluffBaseConfig()` and `generateProjectSqlfluffConfig()`.

```typescript
// Before
function generateSqlfluffBaseConfig(existingSqlfluffConfig: string | undefined): string {
  // ...hardcoded dialect = ansi

// After
function generateSqlfluffBaseConfig(
  existingSqlfluffConfig: string | undefined,
  dialect: string | undefined,
): string {
  // dialect = undefined → use 'ansi' (still generates config — style rules work)
  // dialect = 'postgres' → write dialect = postgres
  const resolvedDialect = dialect ?? 'ansi';
```

### 3. Thread dialect into generators

Call `detectSqlDialect(cwd)` inside the generator, since generators already receive `ctx.cwd`:

```typescript
export const dbtOwnedFiles: Record<string, FileDefinition> = {
  '.safeword/sqlfluff.cfg': {
    generator: ctx => {
      if (!ctx.languages?.dbt) return undefined;
      const dialect = detectSqlDialect(ctx.cwd);
      return generateSqlfluffBaseConfig(ctx.projectType.existingSqlfluffConfig, dialect);
    },
  },
};
```

### 4. Tests

| Test                                              | What it verifies                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| Unit: `detectFromProfiles`                        | Reads profiles.yml, matches profile name, maps type → dialect        |
| Unit: `detectFromProfiles` with global fallback   | Falls through to `~/.dbt/profiles.yml` when local missing            |
| Unit: `detectFromProfiles` multi-project profiles | Matches correct profile, ignores unrelated profiles                  |
| Unit: `detectFromPythonDeps` requirements.txt     | Matches `dbt-postgres==1.8.0` → `postgres`                           |
| Unit: `detectFromPythonDeps` pyproject.toml       | Matches `dbt-snowflake` in dependencies → `snowflake`                |
| Unit: mapping table                               | All adapter names map correctly, mismatches (spark→sparksql) covered |
| Unit: unknown adapter                             | Returns `undefined` for unknown adapter names                        |
| Integration: dbt project with profiles.yml        | Setup generates correct dialect in config                            |
| Integration: dbt project with requirements.txt    | Setup detects from Python deps when profiles.yml missing             |
| Integration: no signals                           | Config uses `ansi`, sqlfluff still runs for style rules              |

---

## What This Does NOT Cover

- **Multi-dialect projects** — First detected dialect wins. Rare in practice (one project = one warehouse).
- **Per-file dialect** — SQLFluff doesn't support this (issue #3559).
- **Lint hook re-detection** — Too expensive (network call to npm). Next `safeword upgrade` handles it.
- **Stop hook SQL quality prompts** — Complementary but separate work.
- **Manual override** — A `safeword config set sql.dialect postgres` escape hatch would be useful but is a separate feature (applies to all packs, not just SQL).

---

## Design Decisions Log

### Why not detect from ORM configs?

The dbt pack only activates when `dbt_project.yml` exists. ORM configs (Prisma, Drizzle, Knex) are irrelevant because they exist in non-dbt projects where the pack doesn't run. Building detection for signals that can't trigger the pack is over-engineering. If we later create a broader "SQL pack" that activates on any `.sql` file, ORM detection should be added then.

### Why not "skip linting entirely" when unknown?

Considered and rejected. `ansi` handles style rules (capitalisation, indentation, line length) correctly on all SQL. It only fails on dialect-specific syntax (casting, DDL, functions). Skipping entirely means zero mechanical checking — worse than imperfect checking. The parse errors from `ansi` on dialect-specific syntax are informative: SQLFluff explicitly warns "Have you configured your dialect?" which guides the user to the fix.

### Why not a "best guess parent dialect" fallback?

Considered and rejected. SQLFluff dialects are NOT strictly additive — child dialects replace entire keyword sets. Postgres rejects Snowflake syntax; Snowflake rejects Postgres syntax. There is no safe parent dialect. Market share: Snowflake (33%), Postgres (21%), BigQuery (15%), Redshift (12%). No single dialect covers even a majority.

### Why not re-detect in the lint hook?

Running `bunx safeword@latest upgrade --yes` mid-lint means a network call, package resolution, download, and reconciliation — all blocking Claude. The existing auto-upgrade fires once per session when configs are genuinely missing. Adding a second trigger for dialect staleness isn't worth the latency. The next manual or auto-triggered `safeword upgrade` handles it.

### Why Python deps as a signal?

`profiles.yml` is the canonical source but is often gitignored (contains credentials). Python dependency files (`requirements.txt`, `pyproject.toml`) are always version-controlled and always list the adapter package (`dbt-postgres`, `dbt-snowflake`, etc.). This is a high-confidence, always-available signal specific to dbt projects.

---

## SQLFluff Supported Dialects (Reference)

28 dialects as of SQLFluff v4.x (current: v4.0.4, Jan 2026):

`ansi`, `athena`, `bigquery`, `clickhouse`, `databricks`, `db2`, `doris`, `duckdb`, `exasol`, `flink`, `greenplum`, `hive`, `impala`, `mariadb`, `materialize`, `mysql`, `oracle`, `postgres`, `redshift`, `snowflake`, `soql`, `sparksql`, `sqlite`, `starrocks`, `teradata`, `trino`, `tsql`, `vertica`

Inheritance tree (relevant branches — child rejects sibling syntax, not additive):

- `postgres` → `redshift`, `greenplum`, `materialize`, `duckdb`
- `mysql` → `mariadb`, `starrocks`, `doris`
- `hive` → `impala`; `ansi` → `sparksql` → `databricks`
- `ansi` → `snowflake`, `bigquery` (separate branches, incompatible syntax)
