---
id: V2AH4B
slug: codex-self-contained-scripts
type: task
phase: intake
status: in_progress
parent: 2C1E82
created: 2026-08-18T16:58:46.360Z
last_modified: 2026-08-18T16:58:46.360Z
---

# Let Codex skills run without project-local .safeword scripts

**Goal:** Rewrite Codex's skill-invoked scripts (run-review.ts, resolve-project-knowledge.ts, closeout-cleanup.ts, drain-retro-spool.ts, cleanup-zombies.sh, record-skill-invocation.ts, etc.) to shell out via bunx --bun safeword@<version> <subcommand>, the same self-contained pattern Codex's lifecycle hooks (hooks.json) already use, instead of bun .safeword/hooks/<script>.ts / .safeword/scripts/<script>

**Why:** Codex's lifecycle hooks are already self-contained via bunx, but its skill playbooks (verify, audit, review-spec, self-review, closeout, cleanup-zombies, retro-filer, explain) still shell out directly to project-local .safeword/hooks/*.ts and .safeword/scripts/*, so Codex-only projects still need those files installed and kept in sync with no auto-upgrade path — same root problem as Claude's dependency, just via a different mechanism (direct file path vs missing env wiring)

## Work Log

- 2026-08-18T16:58:46.360Z Started: Created ticket V2AH4B
