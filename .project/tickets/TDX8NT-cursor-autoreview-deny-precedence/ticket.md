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

**Goal:** Confirm that safeword's `beforeShellExecution` deny still wins when Cursor's Auto-review Run Mode would otherwise auto-approve a shell command.

**Why:** Cursor 3.6 (May 29) added Auto-review for Shell, MCP, and Fetch calls. If Auto-review can short-circuit or race the shell hook decision, safeword's command gate is undermined.

## Scope

This ticket is Shell-only because safeword already wires `beforeShellExecution`.
MCP safety is split to `JFBFEP` because safeword does not yet wire
`beforeMCPExecution`; that needs a policy decision and implementation, not just a
precedence test.

## Done when

- Empirically verified, with Auto-review Run Mode on, that a safeword `beforeShellExecution` `deny` still blocks a shell command (or documented otherwise + mitigation).

## Source

- Cursor changelog: Auto-review applies to Shell, MCP, and Fetch calls.
- Cursor hooks docs: `beforeShellExecution` can return `allow`, `deny`, or `ask`.

## Work Log

- 2026-05-31 Created from Cursor research — flagged as a race risk.
- 2026-06-24 `/figure-it-out` decision: keep this ticket focused on the shell gate
  that exists today. Split MCP to `JFBFEP` because adding a `beforeMCPExecution`
  gate is policy/design/build work, not just verification.
