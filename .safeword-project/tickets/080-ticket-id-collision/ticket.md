---
id: '080'
slug: ticket-id-collision
title: 'Ticket system: prevent ID collisions from parallel sessions'
type: Bug
status: open
---

# Task: Ticket system: prevent ID collisions from parallel sessions

**Type:** Bug

**Scope:** Prevent ticket ID collisions when multiple Claude sessions create tickets concurrently. Currently the ticket-system skill finds the highest existing ID and increments, but a parallel session can create a ticket with that same ID before the first session commits.

**Out of Scope:** Changing ticket ID format, migrating existing tickets, adding a central ticket database.

**Context:** Three collisions in one session (073, 076, 077) because another parallel session was creating tickets simultaneously. The skill's "find highest ID" lookup is a race condition.

**Fix options:**

1. **Lockfile** — Write a `.safeword-project/tickets/.lock` before scanning, remove after creating. Simple but fragile (stale locks).
2. **Atomic directory creation** — Use the filesystem as the lock: `mkdir` is atomic on POSIX. If `mkdir 073-slug` fails because it exists, increment and retry.
3. **Timestamp-based IDs** — Use `YYYYMMDD-HHMMSS` or similar instead of sequential integers. No collisions possible, but loses the clean ordering.
4. **Random suffix** — `073a`, `073b` on collision. Ugly.

Option 2 is simplest and most robust — retry on `EEXIST`.

## Files

- `.claude/skills/ticket-system/SKILL.md` — update ID assignment guidance to handle collisions

**Done When:**

- [ ] Concurrent ticket creation from parallel sessions does not produce ID collisions
- [ ] Existing sequential ID format preserved
