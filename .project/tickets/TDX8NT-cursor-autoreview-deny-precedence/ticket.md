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
- Cursor hooks docs: exit code `2` blocks an action, equivalent to `permission: "deny"`.
- Cursor community reports, 2026-06-24: `deny` is the only shell-hook permission
  consistently enforced today; `allow` and `ask` are not reliable enough for
  safeword policy.

## Verification

2026-06-24 on Cursor `3.8.23`, with Run Mode set to Auto-review with sandbox:

- Baseline: the harmless sentinel shell command ran without the temporary deny
  hook, printed `TDX8NT_SENTINEL_BASELINE_RAN_AUTOREVIEW_SANDBOX`, and wrote
  `.project/tmp/tdx8nt-sentinel.txt`.
- Deny test: after adding a temporary `beforeShellExecution` hook with
  `failClosed:true` and matcher `TDX8NT_SENTINEL_DENY_RAN`, Cursor blocked the
  same class of shell command with `TDX8NT_SENTINEL_DENIED`.
- Evidence check: the denied command's stdout did not appear, and
  `.project/tmp/tdx8nt-denied.txt` was not created.
- Cleanup: removed the temporary hook and sentinel artifact. No production hook
  code changed.

## Work Log

- 2026-05-31 Created from Cursor research — flagged as a race risk.
- 2026-06-24 `/figure-it-out` decision: keep this ticket focused on the shell gate
  that exists today. Split MCP to `JFBFEP` because adding a `beforeMCPExecution`
  gate is policy/design/build work, not just verification.
- 2026-06-24 `/quality-review` tightened the test plan: prove a baseline command
  runs first, then prove the temporary deny hook blocks the same command shape in
  a clean worktree from `origin/main`.
- 2026-06-24 Verified with Cursor Run Mode set to Auto-review with sandbox:
  `beforeShellExecution` `deny` blocked the sentinel shell command even though
  the baseline shell command ran first. This confirms safeword's shell deny path
  wins for the tested Auto-review-with-sandbox execution path.
