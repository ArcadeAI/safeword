---
id: 095
type: task
phase: done
status: done
created: 2026-03-29T22:27:00Z
last_modified: 2026-03-29T22:27:00Z
---

# Session State Lifecycle — Clear Done Tickets

**Goal:** Automatically clear the session's `activeTicket` when a ticket reaches `done` phase, so the done-phase gate doesn't block subsequent non-ticket work in the same session.

**Why:** After ticket 094 was marked done, the session state still had `activeTicket: "094"` with `lastKnownPhase: "done"`. The `done` phase is in `PLANNING_PHASES`, so all code edits were blocked. Required manually editing the session state JSON to unblock.

## Problems Remaining After Ticket 094 Fix

Ticket 094 fixed cross-session blocking (other sessions' tickets don't affect this session). But within a single session, these issues remain:

### 1. Done ticket blocks subsequent work

After marking a ticket done, the session state retains it as `activeTicket`. Since `done` is in `PLANNING_PHASES`, all edits are blocked until:

- The state file is manually edited (meta-path exempt, but shouldn't be needed)
- A new ticket is started (overwrites `activeTicket`)

**Expected:** When `post-tool-quality.ts` detects the ticket is at `done`, it should clear `activeTicket` from the session state.

### 2. No way to "release" a ticket without starting another

If a session finishes a ticket and wants to do ad-hoc work (patches, refactoring), there's no mechanism to release the ticket from the session state.

### 3. Gate persists after ticket status changes

The commit-hash gate clearing works for LOC/phase/TDD gates, but the phase-access check re-evaluates the ticket on every call. If the ticket is `done` and the commit hash hasn't changed, the phase check blocks immediately.

## Proposed Fix

In `post-tool-quality.ts`, when scanning for the active ticket:

- If the session's `activeTicket` resolves to a ticket at `done` or `backlog` status → clear `activeTicket` and `lastKnownPhase` from the state
- This makes the session "release" completed tickets automatically

Alternatively, `pre-tool-quality.ts` could skip phase enforcement when the ticket's status is `done` (not just when phase is `implement`).

## Scope

### In scope

- Auto-clear `activeTicket` in session state when ticket reaches done/backlog
- Or: skip phase enforcement for done-status tickets in pre-tool hook

### Out of scope

- Cross-session isolation (fixed in ticket 094)
- BDD done-gate behavior (separate concern — stop hook handles evidence)

## Work Log

- 2026-03-29T22:36:00Z Complete: pre-tool hook now checks ticket status (in_progress only). Done/backlog tickets don't block. getTicketPhase→getTicketInfo returns {phase, status}.
- 2026-03-29T22:35:00Z Research: Claude Code docs recommend stateless re-evaluation. Fix: read ticket status directly, not from cached state.
- 2026-03-29T22:27:00Z Created: observed done-phase blocking after ticket 094 completion. Required manual state file edit to unblock.

---
