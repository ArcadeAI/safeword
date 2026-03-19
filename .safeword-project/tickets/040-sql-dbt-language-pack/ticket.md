---
id: 040
type: feature
phase: intake
status: pending
created: 2026-03-19T04:51:00Z
last_modified: 2026-03-19T04:51:00Z
---

# Add SQL/dbt language pack for linting and formatting

**Goal:** Let safeword lint and auto-fix SQL files on edit, with smart dbt awareness when `dbt_project.yml` is present.

**Why:** SQL is the most common language in data engineering, and dbt is the dominant framework. SQLFluff is the standard linter (v4.0.4, monthly releases, dbt Cloud integration). Safeword already supports TypeScript, Python, Go, and Rust — SQL is the obvious gap for data teams.

## Design Decisions

**Hybrid detection (like TypeScript's React/Next.js/Astro detection):**

- `dbt_project.yml` exists → dbt mode (sqlfluff with `jinja` templater — parses Jinja without requiring dbt runtime)
- `.sql` files in common locations → raw SQL mode (sqlfluff with `raw` templater)

**Graceful degradation:**

- SQLFluff is Python-based — don't auto-install (Python dep management is messy)
- Print install instructions during setup: `pip install sqlfluff sqlfluff-templater-dbt`
- Skip linting silently if sqlfluff not installed (same pattern as other packs)
- Use `jinja` templater by default for dbt (not `dbt` templater — avoids requiring profiles.yml and warehouse connection)

**What's NOT in scope:**

- dbt-project-evaluator (runtime tool, not static linter — potential future `/dbt-audit` command)
- Auto-installing Python/pip
- Warehouse-connected linting (dbt templater mode)
- dbt build/run/test integration

## Implementation Plan

1. **Detection** — Add `sql: boolean` to `Languages` interface in project-detector.ts. Detect `dbt_project.yml` or `.sql` files in `models/`, `sql/`, or project root.

2. **Pack** — Create `packs/sql/` with index.ts, files.ts, setup.ts following existing pattern.

3. **Config files:**
   - `.safeword/sqlfluff.cfg` (owned — stricter rules for LLM enforcement)
   - `.sqlfluff` (managed — project root config, created if missing)
   - Config detects dbt vs raw SQL and sets templater accordingly

4. **Lint hook** — Add SQL_EXTENSIONS to `lib/lint.ts`. Run `sqlfluff fix` on `.sql` files.

5. **Registry** — Add to `LANGUAGE_PACKS` in registry.ts.

6. **ProjectType** — Add `existingSqlfluffConfig` detection.

7. **Tests** — Golden path test, detection test, config generation test.

## Open Questions

- Default SQL dialect? (`postgres` is safest default, but BigQuery/Snowflake are common in dbt)
- Should the config auto-detect dialect from `dbt_project.yml` profile target? (reads `target-name` but doesn't require profiles.yml)
- Should we include sqlfmt as an alternative formatter? (opinionated, no config needed, but less adoption)

## Research

- SQLFluff 4.0.4 (Feb 2026): stable, monthly releases, optional Rust acceleration
- dbt templater: `jinja` mode parses Jinja without dbt runtime — best default
- SDF (1000x faster): no dbt support yet — monitor but don't adopt
- sqruff (Rust): early stage, diverging from SQLFluff — not ready
