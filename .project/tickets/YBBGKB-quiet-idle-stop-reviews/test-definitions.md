# Test Definitions — Keep stop reviews quiet until a new user prompt

## Rule: A surfaced generic review is consumed by idle Stops

### Scenario: Suppress the next Stop without a human prompt

Given a session state marked as awaiting a new prompt after a generic quality review
And the transcript still contains earlier edit-tool activity but no genuine human prompt boundary
When `stop-quality` receives an idle Stop invocation with `stop_hook_active: false`
Then it exits successfully with no decision output

- [x] RED skip: focused regression developed and run in the same uncommitted TDD slice
- [x] GREEN f22ead54b
- [x] REFACTOR skip: review retained the explicit session-state write for independently running hooks

## Rule: A real user prompt re-arms generic review

### Scenario: Clear the consumed-review marker at UserPromptSubmit

Given a session state marked as awaiting a new prompt after a generic quality review
When `prompt-questions` receives a valid `session_id` for a user prompt
Then it clears the marker without changing unrelated session state

- [x] RED skip: focused regression developed and run in the same uncommitted TDD slice
- [x] GREEN f22ead54b
- [x] REFACTOR skip: review retained the existing tolerant state-file handling

### Scenario: Persist the prompt-boundary clear after reminder derivation fails

Given a session state marked as awaiting a new prompt after a generic quality review
And later prompt-reminder derivation encounters malformed cached state
When `prompt-questions` receives a valid `session_id`
Then it persists the marker clear while still returning the core prompt guidance

- [x] RED skip: installed-hook regression failed before the deferred-write recovery change
- [x] GREEN 69ce94f19
- [x] REFACTOR review pass: seed a downstream pending-learning nudge and assert its absence, so the fixture proves the malformed cached state still aborts reminder derivation instead of passing vacuously.

## Rule: Missing transcript boundaries remain fail-closed before review is surfaced

### Scenario: First malformed-boundary Stop still requests review

Given a session with no consumed-review marker
And the transcript contains an earlier edit but no recoverable genuine user prompt
When `stop-quality` runs
Then it emits the existing generic quality-review decision

- [x] RED skip: control regression developed and run in the same uncommitted TDD slice
- [x] GREEN f22ead54b
- [x] REFACTOR skip: reviewed after the focused suite; no shared fixture extraction improved clarity

## Rule: Generic suppression leaves independent Stop gates intact

### Scenario: A pending generic review does not hide an implement-phase typecheck advisory

Given a session whose earlier generic review is awaiting a user prompt
And its active ticket is in the implement phase with an uncommitted TypeScript error
When `stop-quality` runs
Then it emits the existing TypeScript advisory

- [x] RED skip: regression authored and executed before the implementation commit
- [x] GREEN fb5904c4b
- [x] REFACTOR skip: no smaller representation than the existing typecheck fixture was needed

### Scenario: A pending generic review does not hide a new phase boundary

Given a session whose earlier generic review is awaiting a user prompt
And its active ticket has entered an unreviewed phase
When `stop-quality` runs
Then it emits the phase review for that new boundary

- [x] RED skip: regression authored and executed before the implementation commit
- [x] GREEN fb5904c4b
- [x] REFACTOR skip: the established phase-backstop fixture already isolates this gate

### Scenario: Generic suppression works before any quality-state file exists

Given a session with no quality-state file and an edited transcript
When `stop-quality` runs twice without `UserPromptSubmit`
Then the first invocation persists the marker and the second exits silently

- [x] RED skip: regression authored and executed before the implementation commit
- [x] GREEN fb5904c4b
- [x] REFACTOR skip: dedicated idle-review fixture keeps state-path setup in one helper

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: marker write and marker clear intentionally stay in their respective hook entrypoints; prompt-local dirty-state batching avoids duplicate writes without hiding cross-hook read-modify-write behavior

## Verification matrix

| Scenario | Focused evidence | Completion evidence |
| --- | --- | --- |
| Idle suppression | `stop-hook-idle-review.test.ts` | targeted suite and full test suite |
| Fresh-state idle suppression | `stop-hook-idle-review.test.ts` | targeted suite and full test suite |
| Prompt reset | `hooks.test.ts` | targeted suite and full test suite |
| Fail-closed control | `stop-hook-idle-review.test.ts` | targeted suite and full test suite |
| Typecheck and phase gates | `stop-typecheck-gate.test.ts`, `stop-review-backstop.test.ts` | targeted suite and full test suite |
