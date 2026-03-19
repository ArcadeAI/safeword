---
id: 034
type: task
phase: intake
status: done
parent: 031
created: 2026-03-18T15:28:00Z
last_modified: 2026-03-18T15:28:00Z
---

# Add missing skill frontmatter fields for invocation control

**Goal:** Add `user-invocable: false` to the `testing` skill (reference knowledge, not an action) and evaluate `disable-model-invocation` for action commands once the --resume bug is fixed.

**Why:** The `testing` skill is background knowledge ("how to write good tests"), not a user action. It shows in the `/` menu as `/testing` which is confusing — users expect it to run tests. The `user-invocable: false` field hides it from the menu while keeping it available for Claude to auto-load when relevant.

## Blocked

`disable-model-invocation: true` for action skills (lint, verify, audit, cleanup-zombies) is blocked by [anthropics/claude-code#20816](https://github.com/anthropics/claude-code/issues/20816) — the flag doesn't persist on `--resume`. Revisit when fixed.

## Acceptance Criteria

- [ ] `testing` SKILL.md has `user-invocable: false` in frontmatter
- [ ] `ticket-system` SKILL.md has `user-invocable: false` in frontmatter
- [ ] Skills validation test updated to allow `user-invocable` field
- [ ] Tests pass
