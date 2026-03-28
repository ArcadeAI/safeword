---
id: 065
slug: eslint-plugin-migrations
type: task
status: backlog
phase: research
---

# Task: Migrate eslint-plugin-security 4.0 and eslint-plugin-sonarjs 4.0

**Type:** Improvement

**Scope:** Both plugins introduced 100+ new rules in their major bumps. Need to evaluate which new rules are appropriate for safeword's customer presets vs. which should be disabled. Affects every customer project.

**Out of Scope:** ESLint 10 migration (ticket 051), other plugin bumps already completed.

**Context:** Bumping security 3→4 added `detect-non-literal-fs-filename` (90 hits) and `detect-object-injection` (38 hits). Sonarjs 3→4 added `os-command` (17 hits) and `slow-regex` (5 hits). These fire in customer presets. Currently reverted to 3.x.

**Done When:**

- [ ] security 4.0 rules evaluated — noisy ones disabled in preset
- [ ] sonarjs 4.0 rules evaluated — noisy ones disabled in preset
- [ ] Zero new lint errors in safeword's own codebase
- [ ] Customer preset tested against sample projects

## Work Log

- 2026-03-28 Created from dep bump audit. Reverted to 3.x due to 128+ new errors.
