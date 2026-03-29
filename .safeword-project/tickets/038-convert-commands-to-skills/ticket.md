---
id: 038
type: task
phase: implement
status: in_progress
parent: 031
created: 2026-03-18T15:28:00Z
last_modified: 2026-03-18T15:28:00Z
---

# Convert 4 standalone commands to skills with disable-model-invocation

**Goal:** Convert lint, verify, audit, and cleanup-zombies from `.claude/commands/` to `.claude/skills/` with `disable-model-invocation: true` to prevent Claude from auto-triggering them.

**Why:** These are action commands with side effects (running linters, killing processes, running full audit suites). As commands, they lack `disable-model-invocation` support. As skills, they'd gain invocation control, supporting files, and `context: fork` for isolation.

## Blocked

Blocked by [anthropics/claude-code#20816](https://github.com/anthropics/claude-code/issues/20816) — `disable-model-invocation: true` doesn't persist on `--resume` sessions. Converting without this flag would make things worse (skills auto-trigger, commands don't). Unblock when the bug is fixed.

## Scope

**In scope:**

- Create skill directories: lint/, verify/, audit/, cleanup-zombies/
- Move command content to SKILL.md with proper frontmatter
- Remove `.claude/commands/` entries from schema (keep `.cursor/commands/`)
- Add to deprecatedFiles for upgrade cleanup

**Out of scope:**

- Cursor commands (Cursor has no skills, commands stay)
- Content changes to the commands themselves
