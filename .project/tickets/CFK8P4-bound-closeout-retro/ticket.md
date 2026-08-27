---
id: CFK8P4
slug: bound-closeout-retro
type: task
phase: intake
status: in_progress
parent: KMB053
external_issue: https://github.com/ArcadeAI/safeword/issues/3337
created: 2026-08-13T18:15:54.765Z
last_modified: 2026-08-27T16:35:00.000Z
---

# Keep closeout retrospective bounded to meaningful session work

**Goal:** Let Codex closeout ignore only its positively attributed bookkeeping while preserving fail-closed review of genuine additions.

**Why:** Issue #2805 shows live closeout progress recursively extends the transcript and prevents convergence.

## Work Log

- 2026-08-13T18:15:54.765Z Started: Created ticket CFK8P4
- 2026-08-27T16:35:00.000Z Resumed: Issue #3337 reproduced the same closeout convergence gap after the bounded-window fix for #2805.

## Root Cause

`hasMeaningfulTranscriptGrowth` ignores Codex tool lifecycle records but treats every assistant commentary record as meaningful. The closeout command runs inside a Codex turn whose progress updates are recorded as `event_msg/agent_message` and `response_item/message` records. Those updates extend the transcript during retro extraction, causing up to three expensive catch-up runs and a false incomplete advisory.

The active closeout turn is recoverable from `internal_chat_message_metadata_passthrough.turn_id` on Codex response records. Commentary emitted by that same turn is closeout bookkeeping; user messages, later turns, malformed records, and assistant output from a different turn must remain meaningful.

Confirmed from session `019ff148-e8cb-75e2-b573-c6fbbc144997`: the closeout tool call and repeated progress messages share one turn ID while the guard repeatedly re-extracts. Each observed progress pair is adjacent: an `event_msg` with `payload.type: agent_message` and `payload.phase: commentary`, followed by a `response_item` assistant message with the same text, `payload.phase: commentary`, and the active closeout `turn_id`. Same-turn reasoning and token-count lifecycle records recur between those pairs; `world_state` appeared separately and remains meaningful.

Ruled out:

- Tool lifecycle output as the cause: it is already explicitly ignored and covered by a passing test.
- An unbounded retry loop: retries are capped at three; the cap causes the delay and incomplete advisory but is not the source of transcript growth.
- Treating any sealed snapshot as complete: that could discard genuine user steering or findings appended during extraction.

## Acceptance Criteria

- Closeout ignores Codex commentary appended by the same turn that invoked closeout.
- Closeout still re-extracts user input, malformed records, and assistant output from another turn.
- The existing late-finding and bounded-failure protections remain green.
