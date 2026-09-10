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

- Codex review dispatch uses a previously installed exact-command allow rule without surfacing a
  host approval request; status polling remains in the normal workspace sandbox.
- Generated Codex review skills retain the zero-approval instruction.
- This machine's combined Arcade/Bosslevel MCP server automatically approves all of its tools.
- This machine has a narrow allow rule for the exact installed Safeword runtime's `review run`
  prefix; it excludes `review status` and arbitrary Bun commands.

## Out of Scope

- Disabling Codex approvals globally.
- Granting automatic approval to unrelated MCP servers.
- Changing the review packet, reviewer selection, or review verdict contract.

## Done When

- Every canonical review-launch surface permits escalation only through a previously installed
  exact-command rule, forbids surfaced approval requests, and forbids escalation for status polls.
- Generated Claude and Codex plugin artifacts carry the source-template behavior.
- The Arcade/Bosslevel MCP server uses `default_tools_approval_mode = "approve"`.
- The exact installed Safeword review dispatcher can reach its reviewer without granting general
  sandbox network access.
- Focused review parity and generated-plugin checks pass.

## Test Plan

- RED: the canonical review-surface test fails until every review caller preserves the no-prompt
  dispatch rule and normal-sandbox status boundary.
- GREEN: the focused review parity suite and generated Codex plugin check pass.
- Manual: inspect the effective Codex config for the Arcade/Bosslevel server approval mode and
  sandboxed-network settings without exposing secrets.

## Work Log

- 2026-09-10T23:06:30.082Z Started: Created ticket 5H7NA3
- 2026-09-10T23:08:00Z Scoped: User requires zero approval prompts for Safeword reviews and
  every Arcade/Bosslevel MCP call; unrelated Codex protections remain in place.
- 2026-09-10T23:24:00Z Implemented: Added and execpolicy-tested an exact installed-runtime allow
  rule for `review run`; confirmed it does not match `review status` or arbitrary Bun scripts.
- 2026-09-10T23:25:00Z Configured: Set the combined Arcade/Bosslevel MCP server's default tool
  approval mode to `approve`.
- 2026-09-10T23:26:00Z Verified: Focused review surface suite passes 44/44; Claude and Codex
  generated-plugin checks are current; a sandboxed missing-ID status probe reported no network
  effects.
- 2026-09-10T23:31:00Z Restart check: Codex replaced the cachebuster build with stable `0.83.1`,
  changing the immutable runtime path. Refreshed the exact-command rule and installed review
  examples for that live path; execpolicy matches dispatch only and excludes status/arbitrary Bun.
- 2026-09-10T23:32:00Z Pending activation: The running Codex process loaded rules before the path
  refresh, so a real dispatch still reached auto-review and was denied. One final restart is needed
  to load the refreshed stable-path rule; no one-off payload approval was requested.
