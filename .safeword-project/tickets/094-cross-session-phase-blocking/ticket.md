---
id: 094
type: task
phase: intake
status: backlog
created: 2026-03-29T21:25:00Z
last_modified: 2026-03-29T21:25:00Z
---

# Cross-Session Phase-Access Blocking

**Goal:** Prevent stale `in_progress` tickets from other sessions from blocking code edits in the current session.

**Why:** During a 5-hour audit session, the phase-access hook (`pre-tool-quality.ts`) repeatedly blocked code edits because tickets from parallel/old sessions were `in_progress` at non-implement phases. Required manual ticket-by-ticket cleanup to unblock.

## Problem

The `pre-tool-quality.ts` hook finds the "active ticket" by scanning all ticket files for the most recently modified `in_progress` non-epic ticket. It has no concept of sessions — a ticket being worked on in Session A blocks edits in Session B.

### Symptoms Observed (2026-03-29)

1. Ticket 055 (`define-behavior`, from earlier session) blocked edits → set to `backlog`
2. Ticket 054 (`define-behavior`, from earlier session) blocked edits → set to `backlog`
3. Ticket 038 (`intake`, from Mar 18) blocked edits → set to `backlog`
4. Tickets 092, 093 (created by parallel session during this session) blocked edits → marked `done`
5. After clearing all, per-session state file still had `gate: "phase:intake"` cached → required commit to clear

### Root Cause

- `lib/active-ticket.ts` scans ALL tickets globally, not per-session
- No session affinity — any `in_progress` ticket from any session is treated as "active"
- Per-session state files cache the gate, but gate only clears on commit hash change
- lint-staged stash/restore cycle can revert ticket status changes (observed with ticket 038)

## Options to Explore

### A) Per-session ticket binding

Store the active ticket ID in the per-session state file. Only enforce phase access for the ticket bound to THIS session. Other sessions' tickets are invisible.

**For:** Clean isolation. Each session works independently.
**Against:** How does a session "claim" a ticket? What if two sessions work on the same ticket?

### B) Session-aware active-ticket resolution

`active-ticket.ts` reads the session ID from environment (`CLAUDE_SESSION_ID`) and only considers tickets modified during this session.

**For:** Automatic. No explicit binding.
**Against:** File modification time is unreliable (lint-staged stash changes mtime). Requires session ID in environment.

### C) "No active ticket = no restriction" default

If no ticket matches the current session, allow all edits. Only enforce phase access when the agent explicitly claims a ticket (e.g., via `/bdd` or ticket reference).

**For:** Matches how we actually work — most sessions don't use BDD/tickets.
**Against:** Loses the protection for sessions that DO use tickets.

### D) Staleness timeout

Ignore `in_progress` tickets not modified in the last N minutes (e.g., 30 min). If the hook hasn't seen activity on a ticket recently, assume it's stale.

**For:** Simple. No session awareness needed.
**Against:** Long-running sessions that pause would have their ticket "expire."

## Work Log

- 2026-03-29T21:25:00Z Created: from audit session — blocked 5 times by stale tickets from other sessions. Required manual cleanup of tickets 054, 055, 038, 092, 093 plus a commit to clear cached gate.

---
