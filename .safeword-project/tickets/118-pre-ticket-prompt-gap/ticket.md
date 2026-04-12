---
id: '118'
title: Pre-ticket prompt gap — understanding reminder before ticket exists
type: task
phase: intake
created: 2026-04-12
parent: '109'
related: '115'
---

## Goal

Ensure the understanding-phase reminder survives context compaction even before a ticket is created.

## Problem

The prompt hook (prompt-questions.ts) only injects phase-aware reminders when `state.activeTicket` exists. Before the agent creates a ticket, the only guidance is the two generic core principles ("Contribute before asking", "state what it touches"). The full Understanding section in SAFEWORD.md may get compressed away in large codebases.

This means turns 1-2 of any new conversation — the most important turns for propose-and-converge — have the weakest prompt reinforcement.

## Proposed Change

When `!state.activeTicket` (or no state file exists) and the session has no prior phase context, inject a default understanding reminder:

```
- No active ticket. Understand the request before sizing or coding.
```

One-line addition to prompt-questions.ts. Ensures the agent gets a "slow down and understand" nudge even before any ticket artifact exists.

## Scope

- prompt-questions.ts: add default reminder when no active ticket
- out_of_scope: enforcement of propose-and-converge (no hook validates the agent actually contributed before asking)
- done_when: prompt hook emits understanding reminder on sessions with no active ticket

## Work Log

- 2026-04-12T20:24Z Created: Extracted from #115 design discussion. Pre-ticket gap identified during intake flow tracing.
