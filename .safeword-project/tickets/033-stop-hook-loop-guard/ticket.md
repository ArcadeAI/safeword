---
id: 033
type: patch
phase: intake
status: pending
parent: 031
created: 2026-03-18T15:28:00Z
last_modified: 2026-03-18T15:28:00Z
---

# Guard stop-quality hook against infinite loops with stop_hook_active

**Goal:** Add `stop_hook_active` check to the top of stop-quality.ts to deterministically prevent infinite Stop hook loops.

**Why:** The current loop-prevention relies on Claude emitting a JSON response format (`proposedChanges`/`madeChanges`) — a soft mechanism that Claude can forget, especially after compaction. The official docs explicitly recommend checking `stop_hook_active` from stdin JSON as a deterministic guard.

## Acceptance Criteria

- [ ] stop-quality.ts reads `stop_hook_active` from stdin JSON
- [ ] If `stop_hook_active === true`, exits 0 immediately
- [ ] Existing behavior unchanged when `stop_hook_active` is false/absent
- [ ] Tests pass
