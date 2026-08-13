# Test Definitions: Keep quality reviews observable and actionable

Feature source: `packages/cli/features/reliable-observable-quality-reviews.feature`

test-definitions.md is the R/G/R ledger.

Focused review-runtime regression tests in
`packages/cli/tests/cli-protocol/review-wiring.test.ts`,
`packages/cli/tests/review/runtime.test.ts`, and
`packages/cli/tests/cli-protocol/result.test.ts` own every landed `data.preferred_failure`
classification (`not_installed`, `unsupported`, `probe_timed_out`,
`not_authenticated`, `launch_failed`, `timed_out`, and `invalid_output`), its
recovery, and action-required exit status. The feature lane retains the
`timed_out` and `invalid_output` paths whose streams the progress wiring touches.

## Rule: reliable-observable-quality-reviews.TBU1.R1 — A managed JSON review reports rate-limited lifecycle progress separately from its final typed result

### Scenario: A wrapper-launched slow review remains visibly active until approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The exact managed-progress signal enables JSON progress

- [x] RED 008be3662
- [x] GREEN bde13b50b
- [ ] REFACTOR

### Scenario Outline: Completion cancels the delayed active line at its boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Completion cancels the first heartbeat at its boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Lifecycle progress is delayed and rate-limited

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Managed JSON deliberately suppresses packet-preparation progress

- [x] RED 008be3662
- [x] GREEN bde13b50b
- [ ] REFACTOR

### Scenario: A large clock advance coalesces missed heartbeats

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An action-required result follows progress without losing its classification

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Exhausted routes remain a typed result after visible transitions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A fallback route receives fresh lifecycle timers

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An alternate reviewer model receives fresh lifecycle timers before fallback

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-observable-quality-reviews.TBU1.R2 — Callers that do not request managed progress keep the existing silent machine contract

### Scenario: A direct JSON review stays silent while returning its result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A direct JSON review stays silent on TTY stderr

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Unsupported managed-progress signal values do not change JSON output

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Quiet mode suppresses progress even for a managed review

- [x] RED 008be3662
- [x] GREEN bde13b50b
- [ ] REFACTOR

### Scenario: Quiet mode suppresses progress for a human-readable review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Quiet human-readable action-required output is conveyed by status

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Human output does not duplicate lifecycle progress

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ordinary piped human output retains progress

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Managed JSON progress is identical on TTY stderr

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-observable-quality-reviews.SWM1.R1 — Progress is a best-effort Safeword-owned side channel that cannot alter or disclose reviewer output

### Scenario: Successful reviewer stderr never becomes public output

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Progress write failures do not change terminal review results

- [x] RED 008be3662
- [x] GREEN bde13b50b
- [ ] REFACTOR

### Scenario: Rejected reviewer bytes never become progress output

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Timed-out reviewer bytes never become public output

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Configured model text never enters lifecycle progress

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Hostile target text is safely encoded in exhausted-route recovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-observable-quality-reviews.SWM1.R2 — Every generated required-review workflow delegates to the managed wrapper while remaining compatible with an older resolved CLI

### Scenario: The managed wrapper forwards progress before the review finishes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Installed required-review workflows use the managed wrapper

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The real wrapper scopes managed progress to its CLI child

- [x] RED 9c53a5441
- [x] GREEN b4f05e1a8
- [ ] REFACTOR

### Scenario: The real public command removes managed progress from the reviewer environment

- [x] RED 008be3662
- [x] GREEN bde13b50b
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario

### Scenario: No generated required-review workflow bypasses the managed wrapper

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An older resolved CLI completes silently instead of rejecting the wrapper signal

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
