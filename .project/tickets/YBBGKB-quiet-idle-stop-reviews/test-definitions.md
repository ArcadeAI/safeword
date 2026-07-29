# Test Definitions — Keep stop reviews quiet until a new user prompt

## Rule: A surfaced generic review is consumed by idle Stops

### Scenario: Suppress the next Stop without a human prompt

Given a session state marked as awaiting a new prompt after a generic quality review
And the transcript still contains earlier edit-tool activity but no genuine human prompt boundary
When `stop-quality` receives an idle Stop invocation with `stop_hook_active: false`
Then it exits successfully with no decision output

- [x] RED skip: focused regression developed and run in the same uncommitted TDD slice
- [x] GREEN fe6ddfc4
- [x] REFACTOR skip: review retained the explicit session-state write for independently running hooks

## Rule: A real user prompt re-arms generic review

### Scenario: Clear the consumed-review marker at UserPromptSubmit

Given a session state marked as awaiting a new prompt after a generic quality review
When `prompt-questions` receives a valid `session_id` for a user prompt
Then it clears the marker without changing unrelated session state

- [x] RED skip: focused regression developed and run in the same uncommitted TDD slice
- [x] GREEN fe6ddfc4
- [x] REFACTOR skip: review retained the existing tolerant state-file handling

## Rule: Missing transcript boundaries remain fail-closed before review is surfaced

### Scenario: First malformed-boundary Stop still requests review

Given a session with no consumed-review marker
And the transcript contains an earlier edit but no recoverable genuine user prompt
When `stop-quality` runs
Then it emits the existing generic quality-review decision

- [x] RED skip: control regression developed and run in the same uncommitted TDD slice
- [x] GREEN fe6ddfc4
- [x] REFACTOR skip: reviewed after the focused suite; no shared fixture extraction improved clarity

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: marker write and marker clear intentionally stay in their respective hook entrypoints; no shared abstraction is safer for independently running hooks

## Verification matrix

| Scenario | Focused evidence | Completion evidence |
| --- | --- | --- |
| Idle suppression | `stop-hook-transcript-format.test.ts` | targeted suite and full test suite |
| Prompt reset | `hooks.test.ts` | targeted suite and full test suite |
| Fail-closed control | `stop-hook-transcript-format.test.ts` | targeted suite and full test suite |
