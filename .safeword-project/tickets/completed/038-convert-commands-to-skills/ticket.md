---
id: 038
type: task
phase: implement
status: done
parent: 031
created: 2026-03-18T15:28:00Z
last_modified: 2026-04-18T03:05:00Z
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

## Resolution

Landed 2026-03-29 in `2152533` (feat: convert 4 action commands to skills with disable-model-invocation). Skills live at `.claude/skills/{lint,verify,audit,cleanup-zombies}/`; old command paths are in `deprecatedFiles` (schema.ts:195-198); Cursor command variants retained per out-of-scope note.

Scope shift from the original plan: `disable-model-invocation: true` was added by the conversion commit and then **removed** in `cce2878` — we decided we _want_ Claude to auto-trigger these action skills when contextually appropriate. The upstream blocker (`anthropics/claude-code#20816`) is therefore moot.
