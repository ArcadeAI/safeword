---
id: NDNBTQ
slug: preserve-review-handoff
type: patch
subtype: bug-investigated
phase: intake
status: in_progress
created: 2026-08-07T17:51:02.330Z
last_modified: 2026-08-07T17:51:02.330Z
---

# Keep degraded review available to coding agents

**Goal:** Deliver the typed review result to the author agent when independent routes are exhausted

**Why:** Action-required exit status can prevent the host from reaching the guaranteed fallback

## Work Log

- 2026-08-07T17:51:02.330Z Started: Created ticket NDNBTQ
- 2026-08-07T17:55:00.000Z Found: `review run` emits a complete typed envelope, but its standard `action_required` exit 2 can be treated as a failed tool call before the author agent reaches `/finish-review`.
- 2026-08-07T18:24:00.000Z Implemented: Added opt-in `--agent-handoff` delivery, updated all canonical review-calling skills to request JSON through it, and regenerated Claude/Codex plugin surfaces.
- 2026-08-07T18:25:00.000Z Verified: Source and packaged CLI return the unchanged blocked envelope with exit 0; genuine failures remain exit 1; 73 focused tests, 7,007 full-suite tests, and 34 release tests passed. Formatting, lint, typecheck, and generated-plugin checks passed.
- 2026-08-07T18:26:00.000Z Reviewed: The degraded coordinator review raised only a pre-existing retained-`retro` alias/global-option issue outside this patch; it found no defect in agent-handoff delivery. Keep that debt separate from this fix.

## Root Cause

`review run` uses the CLI-wide `action_required` exit status of 2 for
`REVIEW_ROUTES_EXHAUSTED`. That is correct for automation, but the shipped
agent skills need the same result as a continuation message. They currently
have no explicit delivery mode that preserves the envelope while making the
shell invocation successful for the host agent.

Confirmed by running both source and packaged CLIs: each writes the complete
envelope to stdout and exits 2. The direct command runner captures it, so the
coordinator and serializer are not losing data.

Ruled out: the Claude aggregate dispatcher. Production skills invoke
`safeword review run` directly; the dispatcher does not participate. Claude's
documented hook contract also ignores stdout JSON on exit 2, so forwarding the
envelope there would not provide the required continuation.
