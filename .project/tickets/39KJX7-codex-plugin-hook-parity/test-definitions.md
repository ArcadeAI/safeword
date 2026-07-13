# Test Definitions: Codex plugin hook parity

Feature source: `packages/cli/features/codex-plugin-hook-parity.feature`

test-definitions.md is the R/G/R ledger. Keep executable Given/When/Then
scenarios in the `.feature` file; keep only scenario progress here so hooks can
derive the active RED/GREEN/REFACTOR step.

## Rule: codex-plugin-hook-parity.TB1.R1 - PreToolUse preserves quality gates and proof bridges

### Scenario: Packaged PreToolUse denies the same blocked edit as the legacy adapter

- [x] RED local: focused scenario failed on stale `safeword:explain` hint
- [x] GREEN local: focused scenario passed after Codex `$explain` hint fix
- [x] REFACTOR skip: implementation change is a one-line constant with no duplication

### Scenario: Packaged PreToolUse records skill and review-stamp run identity

- [x] RED local: focused scenario failed with missing `codex-review-stamp-identity.json`
- [x] GREEN local: focused scenario passed after adding packaged review-stamp bridge
- [x] REFACTOR skip: bridge cache write is shared with the existing run identity helper

## Rule: codex-plugin-hook-parity.TB1.R2 - PostToolUse preserves quality state and language-skill nudges

### Scenario: Packaged PostToolUse accumulates quality state through the shared hook

- [x] RED local: focused scenario failed with missing Codex quality-state file
- [x] GREEN local: focused scenario passed after packaged CLI ran package-owned Codex post-tool adapter
- [x] REFACTOR skip: package hook runner is shared for upcoming PostToolUse adapter calls

### Scenario: Packaged PostToolUse forwards language skill nudges

- [x] RED local: focused scenario emitted no JSON for a Go edit
- [x] GREEN local: focused scenario passed after packaged CLI ran package-owned Codex skill-nudge adapter
- [x] REFACTOR skip: adapter runner already shared with PostToolUse quality path

### Scenario: Packaged PostToolUse stays quiet for edits without a language nudge

- [x] RED local: paired with positive nudge RED before adapter call existed
- [x] GREEN local: focused scenario pair passed and markdown edit stayed silent
- [x] REFACTOR skip: no additional structure after shared adapter runner

## Rule: codex-plugin-hook-parity.TB1.R3 - Stop preserves continuations retro work and fail-open behavior

### Scenario: Packaged Stop emits architecture continuation before filing continuation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Packaged Stop runs retro extraction invisibly

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Packaged Stop fails open with valid JSON

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-plugin-hook-parity.TB1.R4 - SessionStart preserves context and auto-upgrade behavior through one dispatcher

### Scenario: Packaged SessionStart runs auto-upgrade before emitting SAFEWORD context

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Packaged SessionStart includes upgrade notices without exit-code blocking

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-plugin-hook-parity.TB1.R5 - UserPromptSubmit preserves queued prompt context

### Scenario: Packaged UserPromptSubmit emits queued Safe Word prompt context

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Packaged UserPromptSubmit stays quiet with no queued prompt context

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-plugin-hook-parity.SM1.R1 - The parity audit names every preserved redesigned and deferred behavior

### Scenario: Event-by-event parity map covers every legacy adapter behavior

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-plugin-hook-parity.SM1.R2 - Deterministic tests prove every must-preserve behavior before live smoke

### Scenario: Plugin manifest commands all use the packaged hook command

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Hidden compatibility alias preserves the packaged hook contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-plugin-hook-parity.SM1.R3 - Live smoke proves the trusted plugin path invokes the package command

### Scenario: Live trusted plugin run observes a package-backed denial

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
