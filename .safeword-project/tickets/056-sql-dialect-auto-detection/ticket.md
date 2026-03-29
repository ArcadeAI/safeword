---
id: 056
type: feature
phase: done
status: done
created: 2026-03-27T00:20:00Z
last_modified: 2026-03-28T05:32:00Z
parent: 057-sql-language-pack
---

# SQL dialect auto-detection for the dbt/SQL language pack

**Goal:** Automatically detect the correct SQLFluff dialect from project signals so that SQL linting works out of the box — zero config from the user.

**Why:** The dbt pack currently hardcodes `dialect = ansi`, which is the most restrictive dialect. It actively rejects valid dialect-specific syntax (`::int`, `ILIKE`, `$$...$$`, etc.), producing false positives on any real-world SQL. Every customer uses a different database (Postgres, Snowflake, BigQuery, ClickHouse, Redshift, etc.) and we can't ask them to configure it manually — Claude Code sets everything up.

**Depends on:** 040-sql-dbt-language-pack (done)

## See also

- [spec.md](spec.md) — full design spec with signal sources, mapping tables, and implementation plan
