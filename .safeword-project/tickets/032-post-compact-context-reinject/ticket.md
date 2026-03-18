---
id: 032
type: task
phase: intake
status: pending
parent: 031
created: 2026-03-18T15:28:00Z
last_modified: 2026-03-18T15:28:00Z
---

# Re-inject ticket context after compaction to prevent context loss

**Goal:** Add a PostCompact hook that re-injects active ticket context, current BDD phase, and quality state after Claude Code compacts the conversation.

**Why:** Long feature sessions lose critical context on compaction — the active ticket, current phase, and quality state vanish. Users hit this during BDD feature work where sessions span many turns. The PostCompact hook event exists specifically for this use case.

## Acceptance Criteria

- [ ] PostCompact hook registered in settings.json template
- [ ] Hook reads quality-state.json and active ticket
- [ ] Hook outputs: ticket ID, goal, current phase, quality gate status
- [ ] Works when no active ticket (graceful no-op)
- [ ] Template + schema registered, tests pass
