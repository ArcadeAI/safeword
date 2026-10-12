---
id: PMZYRG
slug: close-edit-done-gate
type: task
phase: done
external_issue: https://github.com/ArcadeAI/safeword/issues/5546
status: done
created: 2026-10-07T22:51:08.409Z
last_modified: 2026-10-07T23:35:00.000Z
---

# Run the done gate when an edit closes a ticket

**Goal:** Closing a ticket by edit still runs the Stop done gate once, until it passes.

**Why:** PostToolUse cleared activeTicket on close, so Stop skipped tests, scenarios, ledger and verify.md checks.

**PR:** https://github.com/ArcadeAI/safeword/pull/5571

## Scope

- PostToolUse records a "done gate owed" entry when an edit closes a ticket (fail-closed close detection in `hooks/lib/ticket-close.ts`).
- Stop gates owed task/feature/epic tickets first and clears an entry only after every done-gate check passes, one owed ticket per Stop.
- Integration proof through the real hooks (`close-edit-done-gate.test.ts`) and unit tests for close detection.

## Out of scope

- Worktree sessions reading the launch checkout's state (#5467).
- Codex Stop without `session_id` (pre-existing; follow-up task filed).

## Work Log

- 2026-10-07T22:51:08.409Z Started: Created ticket PMZYRG
- 2026-10-07T22:53:00.000Z Delivery ticket opened after implementation on PR 5571 (red-first; tdd-review, refactor, and 10 cross-agent quality-review passes with the final one approved).
- 2026-10-07T22:52:11.556Z Phase: intake → verify
- 2026-10-07T23:30:43.511Z Phase: verify → done
