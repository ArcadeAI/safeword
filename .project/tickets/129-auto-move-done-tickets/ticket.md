---
id: '129'
slug: auto-move-done-tickets
type: task
phase: intake
status: backlog
created: 2026-04-15
---

# Auto-move done tickets to completed/ folder

## Problem

Ticket #008 created the `completed/` folder convention in January 2026 but never wired up automation. After 3+ months, 89 tickets with `status: done` or `phase: done` were still in the main tickets directory. Manually moved in bulk on 2026-04-15.

No hook, skill, or command moves tickets to `completed/` when they're marked done. The convention exists only in the folder structure definition — nothing enforces it.

## Proposed Fix

Add a `git mv` to the post-tool-quality.ts hook when it detects a ticket transitioning to done. The hook already parses ticket.md frontmatter on every edit (lines 129-135) and detects phase transitions. Adding a move is a natural extension.

## Open Questions

- Should the move happen on `status: done`, `phase: done`, or both?
- Should it auto-commit the move, or leave it staged for the agent's next commit?
- Should the active-ticket binding (`activeTicket` in session state) be cleared when the ticket moves?
- Does `git mv` inside a hook cause issues with lint-staged or other hooks?

## Relationship to Other Tickets

- **#008** (ticket folder reorganization): created the convention
- **#098** (unify active ticket model): may affect how activeTicket binding clears on done

## Work Log

- 2026-04-15 Created: discovered during session — 89 done tickets never moved to completed/ because no automation exists
