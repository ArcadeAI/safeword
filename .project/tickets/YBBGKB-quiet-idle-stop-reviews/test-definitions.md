# Test Definitions — Keep stop reviews quiet until a new user prompt

## Rule: A surfaced generic review is consumed by idle Stops

### Scenario: Suppress the next Stop without a human prompt

Given a session state marked as awaiting a new prompt after a generic quality review
And the transcript still contains earlier edit-tool activity but no genuine human prompt boundary
When `stop-quality` receives an idle Stop invocation with `stop_hook_active: false`
Then it exits successfully with no decision output

- [x] RED — add the focused Stop-hook regression test
- [x] GREEN — persist and honor the session marker
- [x] REFACTOR — keep marker writes aligned with existing quality-state conventions

## Rule: A real user prompt re-arms generic review

### Scenario: Clear the consumed-review marker at UserPromptSubmit

Given a session state marked as awaiting a new prompt after a generic quality review
When `prompt-questions` receives a valid `session_id` for a user prompt
Then it clears the marker without changing unrelated session state

- [x] RED — add the prompt-hook state transition test
- [x] GREEN — clear the marker during prompt processing
- [x] REFACTOR — preserve tolerant state-file handling

## Rule: Missing transcript boundaries remain fail-closed before review is surfaced

### Scenario: First malformed-boundary Stop still requests review

Given a session with no consumed-review marker
And the transcript contains an earlier edit but no recoverable genuine user prompt
When `stop-quality` runs
Then it emits the existing generic quality-review decision

- [x] RED — cover the unmarked control case beside the idle regression
- [x] GREEN — preserve the legacy bounded fallback
- [x] REFACTOR — remove duplication in fixture setup if needed

## Verification matrix

| Scenario | Focused evidence | Completion evidence |
| --- | --- | --- |
| Idle suppression | `stop-hook-transcript-format.test.ts` | targeted suite and full test suite |
| Prompt reset | `hooks.test.ts` | targeted suite and full test suite |
| Fail-closed control | `stop-hook-transcript-format.test.ts` | targeted suite and full test suite |
