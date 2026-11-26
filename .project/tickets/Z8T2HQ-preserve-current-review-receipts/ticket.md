---
id: Z8T2HQ
slug: preserve-current-review-receipts
type: task
phase: done
status: done
created: 2026-11-17T17:43:16.478Z
last_modified: 2026-11-17T17:43:16.478Z
---

# Keep current approvals reachable within receipt budget

**Goal:** Validate recent same-scope review stamps before historical entries consume the unchanged shared receipt budget.

**Why:** Separately approved blocker repair for epic 2ENRH5: oldest-first receipt lookup exhausts the shared 12-second budget before authentic current approvals; scope is lookup order and regression tests only.

## Scope and inline tests

Validate newest same-scope stamps first without mutating the caller array. Preserve all receipt predicates, shared 12-second budget, journal history and normal profiles. Authorization: `.project/tickets/2ENRH5-consistent-host-contract/evidence/current-root-receipt-budget-repair-user-approval-20261117.json`.

- [x] RED: Historical lookups consume the shared budget before a current valid approval; demonstrate the missing newest-first behavior through the real reader. Run red2: 102 passed, one intended failure (`expected []` instead of the current stamp); independent test review `0e647c7b-9ae3-4d0e-9f00-0b73eb9f9e2f` approved.
- [x] GREEN: Newest valid approval remains reachable; invalid newest falls through while budget remains; stale, forged and wrong-scope claims remain refused; caller array remains unchanged. Final green2: 103/103 across five files; 1,684 captured inputs verified unchanged after execution.
- [x] REFACTOR: Preserve journal order in the returned results while checking receipts newest-first. All seven focused regressions and all five generated-surface checks passed. The diff audit found no dependency violations, and independent review of the receipt-only source and test changes found no actionable defects.

Out of scope: epic implementation or phase changes, changed budgets/predicates, journal rewriting, native execution and runtime activation. ROOT owns Git and activation. Epic 2ENRH5 remains at plan-execution.

## Work Log

- 2026-11-17T17:43:16.478Z Started: Created ticket Z8T2HQ
- 2026-11-17T17:46:31Z Found: Two-hunk edit was unreconstructable; single-hunk phase advance correctly required intake review. Neither refusal changed canonical bytes. Completing the normal same-phase intake review route.

- 2026-11-26: Split reviewer attribution into PR #8489. Receipt-only verification runs in PR #8426.

- 2026-11-26: Full CI passed on receipt-only code revision c22d1cd2b. Closed this delivery ticket.
