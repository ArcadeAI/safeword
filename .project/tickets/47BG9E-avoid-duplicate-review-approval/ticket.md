---
id: 47BG9E
slug: avoid-duplicate-review-approval
type: task
phase: intake
status: in_progress
created: 2026-09-09T13:38:20.987Z
last_modified: 2026-09-09T13:38:46Z
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/4287
---

# Prevent duplicate review approval prompts for developers

**Goal:** Ensure configured independent reviews dispatch without a redundant chat-level approval prompt while preserving host-native security approvals.

**Why:** Duplicate prompts interrupt review workflows and can encourage agents to skip the configured independent reviewer.

## Scope

- Clarify that configuring a review route authorizes ordinary reviewer dispatch without another chat-level disclosure prompt.
- Preserve host-native sandbox, network, and authentication approval flows.
- Keep required independent-review gates fail-closed and enforce the contract across generated agent surfaces.
- Strengthen parity tests for review dispatch, opt-out, and failure behavior.

## Done When

- Canonical review-launch instructions do not request redundant chat-level approval.
- Required review gates cannot silently degrade or skip the configured reviewer.
- Generated Claude, Codex, and Cursor surfaces remain in parity with canonical templates.
- Full tests, BDD scenarios, lint, typecheck, diff audit, and configured independent quality review pass.

## Work Log

- 2026-09-09T13:38:20.987Z Started: Created ticket 47BG9E
- 2026-09-09T13:38:46Z Linked: PR #4287 and recorded delivered scope and completion criteria.
