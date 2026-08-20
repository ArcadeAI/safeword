---
id: TJ2ZAK
slug: root-tsconfig-ts5097
type: patch
phase: intake
status: in_progress
created: 2026-08-20T05:05:41.651Z
last_modified: 2026-08-20T05:05:41.651Z
---

# Clear the root typecheck error on the retro drain hook lib

**Goal:** Resolve TS5097 reported by root tsc for templates/hooks/lib/drain-retro-spool.ts

**Why:** src/commands/retro-drain.ts imports that hook lib, pulling its .ts sibling specifiers into the root tsconfig program; no script runs the root tsconfig so it is IDE-only noise today, but it misleads anyone typechecking from the repo root

## Work Log

- 2026-08-20T05:05:41.651Z Started: Created ticket TJ2ZAK
