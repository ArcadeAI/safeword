---
id: 098
type: task
phase: done
status: done
created: 2026-03-30T02:47:00Z
last_modified: 2026-03-30T02:47:00Z
---

# Unify Active Ticket Resolution Model

**Goal:** Eliminate the dual-model inconsistency where pre-tool uses session-scoped binding and stop hook uses global ticket scan.

**Why:** Session blocking has required 3 tickets (094, 095, and now this) because the system has two competing models for "which ticket is active" that can disagree. Each fix addresses one model but leaves the other with the old assumption.

## The Problem

Two models coexist:

| Model               | Used by                                  | How it works                                                | Session-aware? |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------- | -------------- |
| **Global scan**     | `stop-quality.ts`, `getActiveTicket()`   | Scans ALL tickets, finds most recently modified in_progress | No             |
| **Session binding** | `pre-tool-quality.ts`, `getTicketInfo()` | Uses session state's `activeTicket` field                   | Yes            |

These can disagree. Stop hook may show review context for a ticket from another session. Pre-tool correctly ignores other sessions' tickets but stop hook doesn't.

### Incident History

| Ticket       | What broke                                        | Root cause                                                  |
| ------------ | ------------------------------------------------- | ----------------------------------------------------------- |
| 094          | Other sessions' tickets blocked code edits        | Pre-tool used global scan instead of session state          |
| 095          | Done tickets blocked subsequent work              | Session state cached activeTicket without status validation |
| This session | Done-phase gate blocked after marking ticket done | Post-tool set phase:done gate, pre-tool blocked on it       |

Each fix patched one layer but the architectural split remains.

## Root Cause

The per-session state file was designed for **gate isolation** (LOC counts, phase gates) but got repurposed for **ticket binding** (which ticket this session is working on). The binding was bolted on without removing the global scan from all consumers.

ARCHITECTURE.md line 474 still documents the old behavior: "lib/active-ticket.ts scans ticket directories for the most recently modified in_progress non-epic ticket."

## Proposed Fix: Session Binding Everywhere

1. **Stop hook:** Use session state's `activeTicket` instead of `getActiveTicket()` global scan
   - If session has no `activeTicket` → generic quality review (no ticket context)
   - If session has `activeTicket` → ticket-specific review with phase context

2. **`getActiveTicket()` scope reduced:** Only used for hierarchy navigation (`findNextWork` in stop hook after done gate passes). Not for phase access or review context.

3. **ARCHITECTURE.md updated:** Document the session binding model as the primary mechanism.

4. **Post-tool auto-clear:** When `post-tool-quality.ts` detects the session's ticket is at `done` or `backlog` status, clear `activeTicket` and `lastKnownPhase` from the session state. This prevents the done-phase blocking pattern entirely.

## Design Principles

Per Claude Code hook best practices:

- Hooks should be **stateless re-evaluators** — read current state from source files, not cached state
- Per-session state is for **gate isolation**, not truth caching
- Session ID (`input.session_id`) is the correct isolation primitive

## Files to Change

- `stop-quality.ts` — read session state for `activeTicket` instead of calling `getActiveTicket()`
- `post-tool-quality.ts` — auto-clear `activeTicket` when ticket status is done/backlog
- `lib/active-ticket.ts` — keep `getActiveTicket()` for hierarchy only, update docstring
- `ARCHITECTURE.md` — update "Active ticket resolution" to document session binding model

## Work Log

- 2026-03-30T02:47:00Z Created: after 3rd session-blocking incident in same audit session. Root cause analysis shows dual-model inconsistency across hooks. Research showed Claude Code docs recommend stateless re-evaluation with session_id isolation.

---
