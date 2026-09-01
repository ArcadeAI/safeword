# Test Definitions: OpenCode independent review fallback

Feature source: `packages/cli/features/opencode-independent-review-fallback.feature`

test-definitions.md is the R/G/R ledger.

## Rule: opencode-independent-review-fallback.TBU1.R1 — Existing authors keep their preferred independent reviewer before OpenCode is considered

### Scenario Outline: Existing author pairings remain preferred

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario: A retryable preferred-reviewer failure stays on the preferred route

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario: A terminal preferred-reviewer failure skips retries

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

## Rule: opencode-independent-review-fallback.TBU1.R2 — OpenCode becomes the next independent route before a same-author fallback

### Scenario: OpenCode independently reviews Claude-authored work after Codex cannot complete

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario: OpenCode independent evidence satisfies the required review gate

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario: OpenCode independently reviews Codex-authored work after Claude cannot complete

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario: OpenCode starts when the shared deadline leaves exactly one route budget

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario Outline: OpenCode is not started when the shared deadline cannot fund another route

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario Outline: OpenCode failure preserves the existing degraded policy outcome

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

## Rule: opencode-independent-review-fallback.TBU1.R3 — OpenCode-authored work is reviewed by another runtime and never treats OpenCode self-review as independent

### Scenario: Claude is the preferred reviewer for OpenCode-authored work

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario: Codex reviews OpenCode-authored work when Claude cannot complete

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario Outline: OpenCode self-review cannot satisfy independence

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

## Rule: opencode-independent-review-fallback.TBU1.R4 — Every OpenCode result meets the same read-only, bounded, and provenance-checked contract as other reviewers

### Scenario: A complete OpenCode event stream yields verified independent evidence

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario Outline: Ambiguous OpenCode output is rejected

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario: An oversized OpenCode event stream is rejected

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario Outline: Invalid OpenCode provenance is rejected

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario: A mismatched OpenCode dispatch blocks the required command

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario: A denied OpenCode tool request cannot produce partial evidence

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario: Reviewed-source mutation makes OpenCode evidence stale

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario: Disposable-packet mutation fails OpenCode evidence

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario: A timed-out OpenCode route records no evidence

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

### Scenario: A failed OpenCode process records no evidence

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

## Rule: opencode-independent-review-fallback.TBU1.R5 — Unsupported author runtimes remain unsupported

### Scenario Outline: Unsupported authors do not gain an OpenCode route

- [x] RED skip: retrospective recovery — approved scenario predates this resumed session; original terminal RED output was not retained
- [x] GREEN 2b56cef52
- [x] REFACTOR skip: cross-scenario review found no behavior-preserving structural improvement for this scenario

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: explicit route-state plumbing is load-bearing provenance; no structural change warranted
