---
id: 039
type: task
phase: implement
status: done
parent: 031
created: 2026-03-19T00:28:00Z
last_modified: 2026-03-19T00:28:00Z
---

# Remove JSON response format, trigger quality review on edit tools only

**Goal:** Replace the self-reporting JSON format (`proposedChanges`/`madeChanges`/`askedQuestion`) with direct edit-tool detection. Quality reviews only fire when Claude actually edited files.

**Why:** The JSON format is soft enforcement asking Claude to self-report what the system can observe directly. When Claude forgets the JSON (after compaction, long sessions), the stop hook either loops forever or exits prematurely. Direct tool detection is deterministic and removes visual noise from every response.

## Changes

1. **SAFEWORD.md** — remove "Response Format" section (~15 lines)
2. **quality.ts** — remove `JSON_SUFFIX` from all phase messages
3. **stop-quality.ts** — remove JSON extraction/parsing, replace with pure edit-tool detection
4. **Config template** — remove JSON_SUFFIX from quality.ts template

## What stays unchanged

- Done-phase hard block (evidence validation)
- Phase-aware quality messages
- LOC/refactor/phase gates
- Ticket hierarchy navigation
- Usage limit detection
- Post-edit linting

## Acceptance Criteria

- [ ] No JSON response format in SAFEWORD.md
- [ ] Quality review only triggers when edit tools detected
- [ ] Conversational responses exit silently (no review)
- [ ] Done-phase hard block still works
- [ ] stop_hook_active fallback still works
- [ ] Tests pass

## Work Log

- 2026-03-19T00:28:00Z Started: Implementing JSON format removal
