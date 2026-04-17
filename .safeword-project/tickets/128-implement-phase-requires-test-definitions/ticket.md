---
id: '128'
slug: implement-phase-requires-test-definitions
type: task
phase: done
status: done
last_modified: 2026-04-17T13:03:00Z
created: 2026-04-15
scope: Add hard gate in pre-tool-quality.ts that denies application code edits when a feature ticket is at implement phase but test-definitions.md doesn't exist. Reads ticket state directly from disk (per #124). Tasks are exempt (per #126 retro).
out_of_scope: Graduated warnings, phase transition enforcement, task-level TDD gates, changing prompt hook reminders
done_when: Feature at implement phase without test-definitions.md is denied app code edits; tasks are exempt; META_PATHS exempt; no ticket = no gate; tests pass
---

# Implement phase requires test-definitions.md gate

## Problem

An agent can write implementation code without ever creating test-definitions.md. SAFEWORD.md states "you can't start TDD without test-definitions.md" (line 175), but this is a stated principle, not an enforced gate.

The pre-tool-quality.ts hook only gates:

- **test-definitions.md creation** — requires scope/out_of_scope/done_when in ticket frontmatter
- **LOC threshold** — commit every ~400 lines

No gate blocks writing application code when `phase: implement` and test-definitions.md doesn't exist.

## Discovery Context

Found during ticket #120 (ESLint override presets). The agent went from intake → writing implementation code → tests after the fact. The prompt hook showed "Phase: implement. Pick first unchecked scenario, start TDD" but only after implementation was already complete. The reminder was too late — a soft nudge after code was written, not a hard gate before.

Contributing factors:

- Phase transitions are self-reported (agent edits ticket frontmatter)
- The agent changed phase from intake → implement in the same commit as the implementation code
- All non-LOC gates were demoted to reminders in ticket #109 (enforcement redesign)

## The Gap

```
pre-tool-quality.ts line 179:
// All other gates (tdd:*, phase:*) are now reminders via prompt hook, not hard blocks.
```

This deliberate design choice means the prompt hook is the only TDD enforcement, and it's advisory. An agent that ignores the reminder faces no structural barrier.

## Open Questions

- Should this be a hard gate (deny the edit) or a graduated response (warn first, block after N edits)?
- Should it fire in any phase with an active ticket, or only in `implement` phase?
- What about legitimate non-TDD edits in implement phase (ticket.md updates, config changes, docs)?
- How does this interact with ticket #124 (derive phase state) which removes lastKnownPhase caching?
- Is the real issue that phase transitions are self-reported rather than system-enforced?

## Relationship to Other Tickets

- **#109** (enforcement redesign): parent decision that demoted phase gates to reminders
- **#124** (derive phase state): changes how phase is read — gate should derive from ticket.md directly
- **#125** (TDD step fragility): adjacent concern — #125 is about TDD step accuracy once in TDD, this is about entering TDD at all

## Work Log

- 2026-04-16T21:25:00Z Implemented: Hard gate in pre-tool-quality.ts after META_PATHS exemption. Reads ticket state from disk via getTicketInfo() (per #124). Features at implement phase without test-definitions.md get denied. Tasks exempt. 7 tests added to quality-gates.test.ts (Suite 11). Template synced.
- 2026-04-16T16:04:00Z Cross-ref: Ticket #126 retro evaluated this gap for tasks. Decision: tasks without test-definitions.md intentionally get no TDD tracking — the sizing boundary (task vs feature) makes tasks lighter by design. If a task needs that rigor, it should be sized as a feature. Gate should target features only, or explicitly exempt tasks.
- 2026-04-15 Created: discovered during ticket #120 post-mortem — agent skipped TDD entirely, no gate fired
