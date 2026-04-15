---
id: '124'
type: feature
phase: implement
status: in_progress
created: 2026-04-14T20:50:00Z
last_modified: 2026-04-15T13:22:00Z
scope:
  - Remove lastKnownPhase and lastKnownTddStep from QualityState interface
  - 'prompt-questions.ts: derive phase via getTicketInfo() instead of reading cache'
  - 'session-compact-context.ts: use per-session state + direct ticket read, drop legacy shared quality-state.json'
  - 'post-tool-quality.ts: remove phase detection block (keep activeTicket binding), remove TDD step detection block, remove parseTddStep()'
  - Add freshness check — clear activeTicket when ticket status is not in_progress (at consumption, not write path)
  - 'Cold start fallback: when activeTicket is null, prompt hook outputs "no active ticket"'
out_of_scope:
  - TDD step-level enforcement (escalating gate — separate ticket)
  - Writing phase state to CLAUDE.md (rejected for teams — merge conflicts)
  - Changing how activeTicket binding is established (still set via post-tool-quality on ticket.md edit)
done_when:
  - No hook reads lastKnownPhase or lastKnownTddStep from session state
  - Phase reminders in prompt hook reflect current ticket.md, not stale cache
  - Compaction context hook reads per-session state, not legacy shared file
  - parseTddStep() removed
  - All existing tests pass
  - Legacy quality-state.json dependency removed from compact hook
---

# Derive phase state from ticket files, don't cache it

**Goal:** Eliminate stale phase state in multi-session/multi-developer scenarios by reading phase directly from ticket.md instead of caching in session state.

**Why:** Session state caches `lastKnownPhase` and `lastKnownTddStep`, which drift when teammates change ticket state. The stop hook already derives phase correctly — make the other consumers do the same.

## Scope

**In scope:**

- Remove `lastKnownPhase` and `lastKnownTddStep` from `QualityState` interface
- `prompt-questions.ts`: derive phase via `getTicketInfo()` instead of reading cache
- `session-compact-context.ts`: use per-session state + direct ticket read, drop legacy shared `quality-state.json`
- `post-tool-quality.ts`: remove phase detection block (keep `activeTicket` binding), remove TDD step detection block, remove `parseTddStep()`
- Add freshness check on `activeTicket` — if ticket status is no longer `in_progress`, clear binding
- Cold start fallback: when `activeTicket` is null, prompt hook outputs "no active ticket"

**Out of scope:**

- TDD step-level enforcement (Critique 5 / escalating gate — separate ticket)
- Writing phase state to CLAUDE.md (rejected for teams — creates merge conflicts)
- Changing how `activeTicket` binding is established (still set via post-tool-quality on ticket.md edit)

**Done when:**

- No hook reads `lastKnownPhase` or `lastKnownTddStep` from session state
- Phase reminders in prompt hook reflect current ticket.md, not stale cache
- Compaction context hook reads per-session state, not legacy shared file
- `parseTddStep()` removed
- All existing tests pass
- Legacy `quality-state.json` dependency removed from compact hook

## Work Log

- 2026-04-14T20:50:00Z Created: ticket from architecture debate on phase state dual-storage problem
- 2026-04-15T13:20:00Z Complete: Phase 0-2 — Understanding converged, scope established. Freshness check decision: clear activeTicket at consumption when status !== in_progress (expanded from done/backlog only)
- 2026-04-15T13:22:00Z Complete: Phase 3 — 11 scenarios defined across 7 rules
- 2026-04-15T13:28:00Z Complete: Phase 4 — AODI validated, adversarial pass added 2 scenarios (missing folder, compact freshness). Fixed: 1.2 independence, 6.2 stale premise, 7.1 reclassified as static grep. 13 scenarios across 7 rules.
- 2026-04-15T13:30:00Z Skipped: Phase 5 — architecture clear from proposal. Starting implement.
