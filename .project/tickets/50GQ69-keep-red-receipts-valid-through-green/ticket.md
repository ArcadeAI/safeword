---
id: 50GQ69
slug: keep-red-receipts-valid-through-green
type: patch
phase: intake
status: in_progress
created: 2026-09-16T17:55:07.541Z
last_modified: 2026-09-16T17:55:07.541Z
---

# Keep RED receipts valid through GREEN

**Goal:** Let an approved executable RED receipt authorize GREEN after only declared implementation support files change.

**Why:** The gate currently makes the required RED-to-GREEN implementation transition invalidate its own approval.

## Work Log

- 2026-09-16T17:55:07.541Z Started: Created ticket 50GQ69
- 2026-09-16T17:57:00.000Z Reproduced: An independently approved receipt became stale immediately after its second declared target changed from the intentional RED stub to the GREEN implementation, while the primary proof, scenario, proof plan, ledger, command, and evidence class remained unchanged.

## Root Cause

The executable-RED gate reuses the review job's complete packet fingerprint.
That fingerprint correctly invalidates review reuse when any reviewed file changes,
but GREEN necessarily changes implementation support files after the review. The
gate therefore cannot distinguish a changed primary proof or contract from the
expected RED-to-GREEN implementation transition.

## Scope

- Keep full-packet fingerprints for review deduplication and terminal review status.
- Bind GREEN authorization separately to the primary proof target, context,
  ledger, and execution request.
- Allow later declared target files to change during implementation without
  authorizing changes to the proof or its contract.

## Out of Scope

- Allowing primary proof, scenario, plan, ledger, command, or evidence-class drift.
- Weakening independent-review or failing-execution requirements.

## Done When

- A regression proves a support-target-only implementation change retains GREEN authorization.
- The same regression proves a later primary-proof change still makes the receipt stale.
- Existing executable-RED job and CLI wiring tests pass.
