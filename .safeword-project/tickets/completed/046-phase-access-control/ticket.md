---
id: 046
type: task
phase: done
status: done
created: 2026-03-20T06:03:00Z
last_modified: 2026-03-20T07:54:00Z
parent: 044
---

# Phase-Based Access Control in Pre-Tool Hook

**Goal:** Restrict file edits based on ticket phase — planning phases allow only `.safeword-project/` edits, implement allows everything.

**Why:** Quality gates can be bypassed by committing to clear them, then writing code during planning phases. Phase-as-access-control makes the phase system self-enforcing.

## Design

Pre-tool hook reads active ticket phase from `quality-state.json` and restricts edits:

| Phase                                                 | Allowed edits             | Rationale                       |
| ----------------------------------------------------- | ------------------------- | ------------------------------- |
| intake, define-behavior, scenario-gate, decomposition | `.safeword-project/` only | Planning = artifacts only       |
| implement                                             | Everything                | Coding phase                    |
| done                                                  | `.safeword-project/` only | Wrapping up                     |
| No ticket / no phase                                  | Everything                | No enforcement without a ticket |

## Scope

- `.safeword/hooks/pre-tool-quality.ts` — add phase-based file restriction
- `packages/cli/tests/integration/quality-gates.test.ts` — test coverage

## Work Log

- 2026-03-20 06:03 UTC — Ticket created. Implementing.
