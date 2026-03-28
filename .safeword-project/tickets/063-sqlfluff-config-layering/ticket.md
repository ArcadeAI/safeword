---
id: 063
slug: sqlfluff-config-layering
type: task
status: backlog
phase: research
---

# Task: Verify sqlfluff config layering doesn't override customer rules

**Type:** Investigation

**Scope:** `.safeword/sqlfluff.cfg` extends customer config with strict overrides. Need to verify whether sqlfluff's INI-based config inheritance replaces or merges customer settings. If it replaces, apply the same additive principle as ruff/golangci-lint.

**Out of Scope:** Adding new SQL rules, sqlfluff version upgrades, dialect detection changes.

**Context:** sqlfluff uses INI format with no `extend-select` equivalent. The `.safeword/sqlfluff.cfg` adds capitalization rules, line length, etc. on top of customer config. Need to verify: does sqlfluff merge sections or does the child config replace parent sections?

**Research Needed:**

- How does sqlfluff config inheritance work in INI format?
- Does `[sqlfluff:rules:capitalisation.keywords]` in child replace or merge with parent?
- What's the convention for shared sqlfluff configs?
- Is there a `.sqlfluff` extend mechanism?

**Done When:**

- [ ] Verified whether customer rules are preserved or replaced
- [ ] If replaced: fix to be additive (same principle as ruff/golangci-lint)
- [ ] If merged: document and close

## Work Log

- 2026-03-27 Created during linter config audit. Needs investigation before fix.
