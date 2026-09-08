---
id: JNZ2H5
slug: codex-audit-scope-self-contained
type: task
phase: done
status: done
parent: 2C1E82
created: 2026-08-19T04:59:33.847Z
last_modified: 2026-08-30T08:00:00.000Z
---

# Find a self-contained equivalent for Codex's sourced audit-scope helper

**Goal:** Decide and implement how templates/skills/audit/SKILL.md's three 'source $PROJECT_DIR/.safeword/hooks/lib/audit-scope.sh' calls can work without a project-local file, since sourcing shares shell state (functions/variables) in a way a bunx subcommand invocation cannot replicate

**Why:** audit-scope.sh is sourced, not executed - the run-review.ts pattern (rewrite invocation text to a pinned bunx call) doesn't apply, since a subprocess can't inject functions/variables into the caller's shell; needs its own design (e.g. inline the logic into the skill markdown, or have Codex fetch and eval a pinned script body) before any code changes

## Work Log

- 2026-08-19T04:59:33.847Z Started: Created ticket JNZ2H5
- 2026-08-30T08:00:00.000Z Completed by epic 2C1E82: the packaged audit-scope command emits a sourceable shell contract, preserving caller-shell variables without a project helper.
