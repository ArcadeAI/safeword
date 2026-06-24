---
id: WHFTDK
slug: normalize-hook-run-identity
type: feature
phase: implement
status: in_progress
scope: "Add a shared run identity helper and wire hook state/proof callers to normalized Claude, Codex, and Cursor identities."
out_of_scope: "Full telemetry/export, hook distribution trust changes, and active-ticket detection from #119."
done_when: "Tests prove normalized identities for Claude, Codex, and Cursor, no unknown-session proof writes, quality state uses runtime-scoped keys while reading legacy Claude state, and schema/template/dogfood surfaces are updated."
external_issue: https://github.com/ArcadeAI/safeword/issues/401
created: 2026-06-24T16:02:44.534Z
last_modified: 2026-06-24T16:35:00.000Z
---

# Normalize hook run identity across Claude, Codex, and Cursor

**Goal:** Keep hook state and proof logs attached to the correct agent run across Claude, Codex, and Cursor.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-24T16:02:44.534Z Started: Created ticket WHFTDK
- 2026-06-24T16:08:00.000Z Added engineering scope before behavior/test definition work.
- 2026-06-24T16:12:00.000Z Completed intake understanding and advanced to behavior definition.
- 2026-06-24T16:18:00.000Z Advanced to implementation after defining dimensions, stories, design, and test scenarios.
- 2026-06-24T16:35:00.000Z Implemented normalized run identity, synced dogfood surfaces, and verified targeted tests, lint/typecheck, diff whitespace, and safeword health check.
