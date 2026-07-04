---
id: J2R9HY
slug: prune-unused-exports
type: task
phase: intake
status: backlog
external_issue: https://github.com/ArcadeAI/safeword/issues/718
scope: |
  Investigate and remove (or intentionally retain with justification) the five
  unused exports flagged by knip in the 2026-07-04 audit:
    - CODEX_SESSION_START_HOOK_PATCH   packages/cli/src/schema.ts:194
    - OWNED_LABEL_PREFIXES             packages/cli/src/tracker-sync/labels.ts:11
    - MONITOR_SOURCES                  packages/cli/src/upstream-monitor/index.ts:59
    - normalizeMarkdown (function)     packages/cli/src/upstream-monitor/index.ts:94
    - SYNCTICKETS_QUIET_COMMAND        packages/cli/src/utils/ticket-index-warnings.ts:1
  Line numbers are as-of the branch base and drift with edits — re-run
  `bunx knip` to get current locations.
  For each: confirm it is genuinely unreferenced (knip cannot see consumers
  wired via config/runtime resolution, e.g. the .safeword/hooks dogfood pattern),
  then either delete it or downgrade `export` to module-private.
out_of_scope: |
  - knip's "unresolved imports" findings — those are the known dogfood-hook
    pattern (test files importing .safeword/hooks/* resolved at runtime), not
    dead code. No action; do not silence with config.
  - Dependency version bumps from the same audit — tracked in JCC69C (#717).
  - Broader dead-code sweep beyond these five named exports.
done_when: |
  - Each of the five exports is either removed, or de-exported to module scope,
    or explicitly retained with a one-line comment naming the real (config- or
    runtime-wired) consumer knip cannot see.
  - `bunx knip` no longer reports these five under "Unused exports".
  - `bun run test` and `/lint` (incl. tsc --noEmit) stay green.
created: 2026-07-04T00:18:53.927Z
last_modified: 2026-07-04T00:18:53.927Z
---

# Remove 5 unused exports flagged by knip (audit follow-up)

**Goal:** Resolve the five unused exports knip flagged — delete the truly dead
ones and justify any kept for a consumer knip can't see.

**Why:** Surfaced by the 2026-07-04 audit during the #644 G8 verify pass. These
predate the docs-cleanup change and were out of its scope. Each needs a quick
human check before removal because knip is blind to config-wired and
runtime-resolved consumers (the same reason its "unresolved imports" noise is a
false positive) — so this is a small investigate-then-prune task, not a blind
delete.

## Work Log

- 2026-07-04T00:18:53.927Z Started: Created ticket J2R9HY
- 2026-07-04T00:20:00Z Scoped from audit follow-up (parent context: #644 G8 verify). status → backlog.
