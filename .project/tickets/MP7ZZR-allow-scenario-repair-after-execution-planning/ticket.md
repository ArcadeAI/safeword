---
id: MP7ZZR
slug: allow-scenario-repair-after-execution-planning
type: task
phase: intake
status: in_progress
created: 2026-09-20T18:38:33.806Z
last_modified: 2026-09-20T18:38:33.806Z
---

# Allow scenario repair after execution planning

**Goal:** Let feature authors repair reviewed scenarios after execution planning has begun

**Why:** The coding-authorization hook currently blocks .feature edits in define-behavior and scenario-gate, making a requested scenario correction impossible to review.

## Work Log

- 2026-09-20T18:38:33.806Z Started: Created ticket MP7ZZR
- 2026-09-20T18:37:34.602Z Reproduced: an edit to the active feature source was denied with
  `missing_accepted_scenarios` after the ticket had returned to `define-behavior`.

## Root Cause

The packaged `pre-tool-quality.ts` sends every non-meta edit through coding authorization once an
Execution Plan exists. It does not exempt `.feature` edits while the ticket is in
`define-behavior` or `scenario-gate`, so repairing a rejected scenario requires the approval that
the repair is meant to earn.

Confirmed by comparing the packaged hook with the dogfood hook: the dogfood copy already computes
`isBehaviorDefinitionEdit` and skips coding authorization for that case; the packaged source does
not. Ruled out stale session state by reproducing after a fresh Codex turn. Ruled out a stale ticket
phase by confirming `ticket.md` contains `phase: define-behavior` before the denied edit.

## Tests

- A `.feature` edit is allowed in `define-behavior` even when an Execution Plan exists and coding
  authorization would deny production work.
- The same `.feature` edit is allowed in `scenario-gate`.
- Production source edits remain subject to coding authorization.
