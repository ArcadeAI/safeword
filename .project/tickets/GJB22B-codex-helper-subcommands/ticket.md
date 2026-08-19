---
id: GJB22B
slug: codex-helper-subcommands
type: task
phase: intake
status: in_progress
parent: 2C1E82
created: 2026-08-19T04:59:19.066Z
last_modified: 2026-08-19T04:59:19.066Z
---

# Add public CLI subcommands for Codex's remaining resolver and audit-trace scripts

**Goal:** Build public subcommands for resolve-project-knowledge.ts, resolve-namespace-root.ts, resolve-verify-ticket.ts, audit-principle-trace.ts, and drain-retro-spool.ts, then rewrite their invocations in explain/verify/audit/retro-filer skills to a pinned bunx call, following the run-review.ts precedent in catalogue.ts

**Why:** Each script is invoked directly by a Codex skill (explain, verify, audit, retro-filer) but has no public CLI entry point today; unlike run-review.ts none of these have an existing public subcommand to redirect to, so this is new surface, not just a text rewrite - group them since they share the same shape of fix and are individually small (10-271 lines)

## Work Log

- 2026-08-19T04:59:19.066Z Started: Created ticket GJB22B
- 2026-08-19T05:00:00.000Z Added drain-retro-spool.ts (retro-filer skill) to scope - it's `bun`-executed like the other four, not sourced, so it fits the same pattern.
