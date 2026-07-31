# User Stories — Keep stop reviews quiet until a new user prompt

## Story 1 — Avoid idle assistant output

As a developer whose assistant has already received a Stop quality-review prompt,
I want later idle Stop callbacks to be silent until I send another prompt,
so that Safeword does not manufacture a reply when I have nothing to add.

### Acceptance criteria

- After the generic Stop quality review is surfaced for a session, another Stop invocation without a new human prompt exits with no decision output.
- The suppression is scoped to that session.

## Story 2 — Resume review on real work

As a developer who submits a new prompt after a review,
I want the next real turn to be eligible for normal quality review,
so that quieting idle callbacks does not hide feedback for new edits.

### Acceptance criteria

- `UserPromptSubmit` clears the session's pending-review marker.
- A later edited-work Stop in that session can surface the generic review again.

## Story 3 — Retain conservative malformed-transcript handling

As a maintainer,
I want the first Stop callback with an unrecoverable prompt boundary to retain its current review behavior,
so that transcript-format failures do not silently bypass Safeword quality feedback.

### Acceptance criteria

- With no previously surfaced marker, an edited transcript lacking a genuine user-prompt boundary still produces the generic quality review.
- Existing `stop_hook_active` and hard artifact/done gates remain unchanged.
