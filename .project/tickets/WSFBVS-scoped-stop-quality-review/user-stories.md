# User Stories: Keep stop-quality prompts scoped to edited-work turns

## WSFBVS.1 — Explain completed work without an irrelevant verdict prompt

As an agent following up on completed edited work, I want a later explanatory
response to stop cleanly, so I can answer a conversational question without
being asked for a decision brief about the prior implementation turn.

### Acceptance criteria

- Given an earlier turn used an edit tool, when a later user text prompt starts
  a conversational follow-up, the stop hook exits without a quality-review
  continuation.
- Tool-result messages do not end the active edited-work turn.
- When a transcript has no recoverable user-prompt boundary, the hook retains
  its bounded legacy scan rather than silently skipping review.

## Out of Scope

- Changing done-phase hard gates or decision-brief formatting.
- Changing Cursor or Codex hook adapters.
