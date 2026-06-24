---
id: TDX8NT
slug: cursor-autoreview-deny-precedence
type: task
phase: intake
status: in_progress
epic: cursor-optimization
relates_to: VAX3Z2
---

# Verify hook deny wins over Cursor Auto-review Run Mode (3.6)

**Goal:** Confirm that safeword's `beforeShellExecution` / `beforeMCPExecution` deny still wins when Cursor's Auto-review Run Mode classifier auto-approves Shell/MCP/Fetch calls.

**Why:** Cursor 3.6 (May 29) added a classifier subagent that auto-approves those tool calls. If it can short-circuit or race the hook decision, safeword's command gate is undermined.

## Done when

- Empirically verified, with Auto-review Run Mode on, that a safeword hook `deny` still blocks the shell/MCP call (or documented otherwise + mitigation).

## Source

cursor.com/changelog (3.6 Auto-review Run Mode)

## Work Log

- 2026-05-31 Created from Cursor research — flagged as a race risk.
