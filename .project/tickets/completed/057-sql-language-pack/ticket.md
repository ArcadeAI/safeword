---
id: 057
type: feature
phase: done
status: done
created: 2026-03-27T18:55:00Z
last_modified: 2026-03-28T04:20:00Z
parent: null
children:
  - 056-sql-dialect-auto-detection
---

# Rename dbt pack → SQL pack and broaden activation

**Goal:** Expand the dbt language pack into a general-purpose SQL pack that activates for any project with intentional SQL work — dbt, Flyway, sqlc, Atlas, Prisma migrations, and more.

**Why:** The dbt pack only activates on `dbt_project.yml`, leaving ~20-40% of SQLFluff users (migration authors, sqlc users, stored procedure maintainers) without SQL linting. The templater is a non-issue — `templater = jinja` passes through plain SQL cleanly — so a single pack can serve both dbt and non-dbt SQL.

**Children:**

- [056-sql-dialect-auto-detection](../056-sql-dialect-auto-detection/ticket.md) — dialect detection from project signals

## See also

- [spec.md](spec.md) — full design spec
