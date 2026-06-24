---
id: T3DV1K
slug: cursor-blocking-edit-shell-gates
type: task
phase: intake
status: in_progress
epic: cursor-optimization
relates_to: VAX3Z2
---

# Port phase/LOC gates to Cursor preToolUse + beforeShellExecution deny

**Goal:** Replace observe-only `afterFileEdit` with real blocking: `preToolUse` (deny edits before `test-definitions.md`) and `beforeShellExecution` (LOC/commit gate, dangerous-command policy).

**Why:** `afterFileEdit` can't stop anything — the edit already happened. The phase and LOC gates only enforce via the `before*` blocking events.

## Done when

- `preToolUse` denies edits under the phase-gate condition; `beforeShellExecution` enforces the LOC/commit gate with allow/deny/ask.
- Existing `afterFileEdit` reduced to genuinely-observational duties (lint trigger) or removed if redundant.

## Source

cursor.com/docs/hooks (`preToolUse` permission, `beforeShellExecution` allow/deny/ask)

## Work Log

- 2026-05-31 Created from Cursor research.
