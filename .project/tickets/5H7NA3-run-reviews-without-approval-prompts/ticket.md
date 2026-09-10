---
id: 5H7NA3
slug: run-reviews-without-approval-prompts
type: task
phase: implement
status: in_progress
created: 2026-09-10T23:06:30.082Z
last_modified: 2026-09-10T23:06:30.082Z
---

# Run trusted review routes without approval prompts

**Goal:** Make configured Safeword reviews and the trusted Arcade/Bosslevel MCP route run without per-call approval prompts.

**Why:** Review and MCP approval prompts interrupt the autonomous Safeword workflow the user explicitly enabled.

## Scope

- Codex review instructions run dispatch, retry, fallback, and status commands in the normal
  workspace sandbox without requesting escalation or host approval.
- Generated Codex review skills retain the zero-approval instruction.
- This machine's combined Arcade/Bosslevel MCP server automatically approves all of its tools.
- This machine's workspace sandbox permits the network destinations required by the configured
  independent Claude reviewer.

## Out of Scope

- Disabling Codex approvals globally.
- Granting automatic approval to unrelated MCP servers.
- Changing the review packet, reviewer selection, or review verdict contract.

## Done When

- Every canonical review-launch surface explicitly forbids `require_escalated` and approval requests
  for review commands.
- Generated Claude and Codex plugin artifacts carry the source-template behavior.
- The Arcade/Bosslevel MCP server uses `default_tools_approval_mode = "approve"`.
- The normal workspace sandbox can reach the documented Claude Code endpoints without widening
  filesystem access.
- Focused review parity and generated-plugin checks pass.

## Test Plan

- RED: the canonical review-surface test fails until every review caller requires normal-sandbox,
  zero-prompt execution.
- GREEN: the focused review parity suite and generated Codex plugin check pass.
- Manual: inspect the effective Codex config for the Arcade/Bosslevel server approval mode and
  sandboxed-network settings without exposing secrets.

## Work Log

- 2026-09-10T23:06:30.082Z Started: Created ticket 5H7NA3
- 2026-09-10T23:08:00Z Scoped: User requires zero approval prompts for Safeword reviews and
  every Arcade/Bosslevel MCP call; unrelated Codex protections remain in place.
