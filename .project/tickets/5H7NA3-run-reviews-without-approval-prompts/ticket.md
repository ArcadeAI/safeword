---
id: 5H7NA3
slug: run-reviews-without-approval-prompts
type: task
phase: implement
status: in_progress
created: 2026-09-10T23:06:30.082Z
last_modified: 2026-09-11T04:43:43Z
---

# Run trusted review routes without approval prompts

**Goal:** Make configured Safeword reviews and the trusted Arcade/Bosslevel MCP route run without per-call approval prompts.

**Why:** Review and MCP approval prompts interrupt the autonomous Safeword workflow the user explicitly enabled.

## Scope

- Codex quality, scenario, and implementation-plan review dispatches use previously installed
  kind-scoped allow rules without surfacing a host approval request; status polling remains in the
  normal workspace sandbox.
- Generated Codex review skills retain the zero-approval instruction.
- This machine's combined Arcade/Bosslevel MCP server automatically approves all of its tools.
- This machine has narrow allow rules for the exact installed Safeword runtime's
  `quality-review`, `scenario-gate`, and `plan-implementation` dispatches. Their normal arguments
  remain available, while executable RED reviews, `review status`, and arbitrary Bun commands are
  excluded.

## Out of Scope

- Disabling Codex approvals globally.
- Granting automatic approval to unrelated MCP servers.
- Changing the review packet, reviewer selection, or review verdict contract.

## Done When

- Every canonical review-launch surface permits escalation only through a previously installed
  kind-scoped rule, forbids surfaced approval requests, and forbids escalation for executable RED
  reviews and status polls.
- Generated Claude and Codex plugin artifacts carry the source-template behavior.
- The Arcade/Bosslevel MCP server uses `default_tools_approval_mode = "approve"`.
- The exact installed Safeword review dispatcher can reach its reviewer without granting general
  sandbox network access.
- A live dispatch against the installed runtime reaches the external reviewer without surfacing a
  user approval request.
- Focused review parity and generated-plugin checks pass.

## Test Plan

- RED: the canonical review-surface test fails until every review caller preserves the no-prompt
  dispatch rule and normal-sandbox status boundary.
- GREEN: the focused review parity suite and generated Codex plugin check pass.
- End to end: run a bounded packet through the live installed runtime and verify that Codex applies
  the installed rule without surfacing an approval request.
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
- 2026-09-11T04:34:09Z Verified after restart: A bounded live dispatch through the installed
  `0.83.1` runtime reached Claude and returned a typed `changes_requested` verdict without
  surfacing any user approval. The rule remains deliberately fixed to the installed executable and
  `review run` subcommand while allowing normal review arguments; status and arbitrary Bun commands
  remain outside the rule. Arcade/Bosslevel automatic tool approval also persisted across restart.
- 2026-09-11T04:43:43Z Narrowed after adversarial review: Confirmed that `executable-red` accepts
  an exact command to execute, so a rule ending at `review run` was broader than intended. Replaced
  it with separate rules for the three non-executing review kinds and added an explicit
  normal-sandbox requirement for executable RED reviews. Execpolicy now allows all three ordinary
  review kinds and rejects executable RED, status, and arbitrary Bun commands. Focused parity passes
  44/44 and both generated-plugin checks are current.
