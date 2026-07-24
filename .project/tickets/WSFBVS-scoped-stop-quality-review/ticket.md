---
id: WSFBVS
slug: scoped-stop-quality-review
type: task
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/1096
created: 2026-07-22T13:13:56.518Z
last_modified: 2026-07-24T04:28:07Z
---

# Keep stop-quality prompts scoped to edited-work turns

**Goal:** Skip decision-brief prompts for conversational follow-up turns while retaining the edited-work quality review.

**Why:** A five-message edit scan crosses user-turn boundaries and forces non-decision replies into an inappropriate verdict brief.

## Task Specification

**Type:** Bug

**Scope:** Make the Claude stop-quality hook decide whether to review only from
assistant tool activity in the current user turn. A later conversational reply
must not inherit an earlier edit merely because it falls inside the rolling
five-message scan.

**Out of Scope:** Changing done-phase hard gates, changing the decision-brief
shape, adding persistent acknowledgement state, or changing Cursor and Codex
adapters.

**Done When:**

- [x] An explanatory follow-up after an earlier edited-work turn exits without a decision-brief continuation.
- [x] An incomplete final response from a user turn that did edit still receives the existing quality continuation.
- [x] A malformed transcript without a reliable user-turn boundary retains the conservative existing review behavior.

**Tests:**

- [x] Integration: a genuine user prompt between the prior edit and the final explanatory response resets the edit window.
- [x] Integration: tool-result user messages do not reset the current edited-work window.
- [x] Integration: no prompt boundary falls back to the existing bounded assistant-message scan.

## Root Cause

`detectEditToolsUsed` scans the last five assistant messages without observing
the intervening user message. A natural follow-up such as "explain in English"
therefore inherits the prior implementation turn's edit and triggers a verdict
brief even though the response is not a handoff.

## Decision Record

**Decision:** Scan backward only to the most recent genuine user prompt, while
ignoring `tool_result` messages; if that boundary cannot be recovered, keep the
current bounded scan.

**Alternatives considered:** (1) use only the final assistant message — rejected
because an edited turn's final prose normally contains no `tool_use`; (2) retain
the current five-message window — rejected because it crosses genuine user
turns; (3) add persistent acknowledgement state — rejected because it creates
new state without distinguishing a fresh conversational request.

**Evidence:** Claude's current tool-use documentation represents calls as
assistant `tool_use` content and their returns separately, so user prompts and
tool results must be distinguished. The current hook's transcript model has
those same content blocks. This preserves all done, typecheck, and
disqualification precedence before the review decision.

## Work Log

- 2026-07-22T13:14:08Z Design: `/figure-it-out` selected current-user-turn edit detection. It is the smallest option that suppresses conversational noise without weakening an edited-work review; malformed history remains conservative.
- 2026-07-22T13:14:08Z Revalidated: #1096 remains present after P0D33P's completed-brief suppression. The current hook still scans five assistant messages across a genuine user follow-up.
- 2026-07-22T13:13:56.518Z Started: Created ticket WSFBVS
- 2026-07-22T13:23:14Z Implemented: added current-user-turn detection with a bounded legacy fallback; added three regression integrations. Targeted, focused, lint, and fast-smoke suites pass. Status remains in progress pending user acceptance; no commit was created in the shared dirty worktree.
- 2026-07-23T07:25:48Z Review: completed `/audit`, `/quality-review`, and `/refactor`. The audit found no WSFBVS-attributable issue; the quality review approved the change after checking current primary tool-use docs and the real-hook integration. Extracted the duplicated edit-tool predicate, then reran lint, focused integration tests, full fast smoke, parity, and audit. Status remains in progress pending user acceptance.
- 2026-07-24T04:28:07Z Accepted: user approved the verified change for commit.
- 2026-07-24T05:12:00Z Rebased to current main: migrated the three regression cases from the source-stack-only `stop-quality-response.test.ts` into the current `stop-hook-transcript-format.test.ts` harness; 13 focused integration tests pass.
