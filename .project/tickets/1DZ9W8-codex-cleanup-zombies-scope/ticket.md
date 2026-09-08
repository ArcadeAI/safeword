---
id: 1DZ9W8
slug: codex-cleanup-zombies-scope
type: task
phase: done
status: done
parent: 2C1E82
created: 2026-08-19T04:59:39.360Z
last_modified: 2026-08-30T08:00:00.000Z
---

# Decide whether cleanup-zombies belongs in Codex's self-contained skill set

**Goal:** Resolve whether templates/skills/cleanup-zombies/SKILL.md's direct ./.safeword/scripts/cleanup-zombies.sh invocations should get a bunx equivalent, get dropped from the Codex delivery, or stay project-local by design

**Why:** cleanup-zombies.sh is a weak fit for this epic's rationale (it manages local dev-server/test processes rather than reading project state), so before building anything this needs a scope decision, not just a mechanical rewrite - avoid treating every project-local script the same way

## Work Log

- 2026-08-19T04:59:39.360Z Started: Created ticket 1DZ9W8
- 2026-08-30T08:00:00.000Z Completed by epic 2C1E82: cleanup-zombies remains an advertised workflow and runs through the allowlisted packaged runtime rather than a project script.
