---
id: SF0RS0
slug: codex-closeout-self-contained
type: task
phase: done
status: done
parent: 2C1E82
created: 2026-08-19T04:59:12.527Z
last_modified: 2026-08-30T08:00:00.000Z
---

# Make Codex's closeout skill work without project-local scripts

**Goal:** Give closeout-cleanup.ts (1795 lines, invoked directly by templates/skills/closeout/SKILL.md) an equivalent self-contained bunx path for Codex, or a documented reason it can't have one

**Why:** closeout-cleanup.ts is by far the largest and most complex of the remaining scripts, with its own inconsistent CLI-resolution fallback; it deserves standalone scoping rather than folding into a grab-bag ticket, since a naive rewrite risks silently breaking closeout for every Codex project

## Work Log

- 2026-08-19T04:59:12.527Z Started: Created ticket SF0RS0
- 2026-08-30T08:00:00.000Z Completed by epic 2C1E82: closeout-cleanup runs through the allowlisted packaged runtime with no project-local script dependency.
