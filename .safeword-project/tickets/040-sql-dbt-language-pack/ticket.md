---
id: 040
type: feature
phase: implement
status: in_progress
created: 2026-03-19T04:51:00Z
last_modified: 2026-03-19T04:51:00Z
---

# Add dbt language pack for SQL linting and formatting

**Goal:** Let safeword lint and auto-fix `.sql` files on edit in dbt projects, using SQLFluff with Jinja-aware parsing.

**Why:** SQL is the most common language in data engineering, and dbt is the dominant framework. SQLFluff is the standard linter (v4.0.4, monthly releases, dbt Cloud integration). Safeword already supports TypeScript, Python, Go, and Rust — dbt/SQL is the obvious gap for data teams.

## Design Decisions

**Detection: `dbt_project.yml` only.**

Every dbt project has this file. No ambiguity, no false positives. Random `.sql` files in non-dbt projects don't trigger the pack. Follows the same pattern as Go (`go.mod`), Rust (`Cargo.toml`). Non-dbt SQL support can be added later if demand emerges.

**Templater: `jinja` (not `dbt`).**

The `jinja` templater parses `{{ ref() }}` and `{{ source() }}` syntax without requiring a dbt runtime, `profiles.yml`, or warehouse connection. Good enough for linting. The `dbt` templater is more accurate but requires full dbt setup — not appropriate for a post-edit hook.

**Graceful degradation:**

- SQLFluff is Python-based — don't auto-install (Python dep management is messy)
- Print install instructions during setup: `pip install sqlfluff`
- Skip linting silently if sqlfluff not installed (same pattern as other packs)

**What's NOT in scope:**

- Non-dbt SQL projects (future work if needed)
- dbt-project-evaluator (runtime tool, not static linter — potential future `/dbt-audit` command)
- Auto-installing Python/pip
- Warehouse-connected linting (dbt templater mode)
- dbt build/run/test integration

## Implementation Plan

1. **Detection** — Add `dbt: boolean` to `Languages` interface in project-detector.ts. Detect `dbt_project.yml`.

2. **Pack** — Create `packs/dbt/` with index.ts, files.ts, setup.ts following existing pattern.

3. **Config files:**
   - `.safeword/sqlfluff.cfg` (owned — stricter rules for LLM enforcement, jinja templater)
   - `.sqlfluff` (managed — project root config, created if missing)

4. **Lint hook** — Add SQL_EXTENSIONS to `lib/lint.ts`. Run `sqlfluff fix` on `.sql` files.

5. **Registry** — Add to `LANGUAGE_PACKS` in registry.ts.

6. **ProjectType** — Add `existingSqlfluffConfig` detection.

7. **Tests** — Golden path test, detection test, config generation test.

## Open Questions

- Default SQL dialect? (`ansi` is safest default, but `postgres`/`bigquery`/`snowflake` are common in dbt — could read from `dbt_project.yml`)
- Should we auto-detect dialect from `dbt_project.yml`'s profile target name? (heuristic, not guaranteed)

## Research

- SQLFluff 4.0.4 (Feb 2026): stable, monthly releases, optional Rust acceleration (`sqlfluff[rs]`)
- dbt templater: `jinja` mode parses Jinja without dbt runtime — best default for hooks
- SDF (1000x faster): no dbt support yet — monitor but don't adopt
- sqruff (Rust): early stage, diverging from SQLFluff — not ready
- dbt-project-evaluator: architecture linter (DAG rules, not SQL style) — separate concern, potential future `/dbt-audit`
