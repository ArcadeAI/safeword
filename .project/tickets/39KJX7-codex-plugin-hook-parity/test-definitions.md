# Test Definitions: Codex plugin hook parity

Feature source: `packages/cli/features/codex-plugin-hook-parity.feature`

test-definitions.md is the R/G/R ledger. Keep executable Given/When/Then
scenarios in the `.feature` file; keep only scenario progress here so hooks can
derive the active RED/GREEN/REFACTOR step.

## Rule: codex-plugin-hook-parity.TB1.R1 - PreToolUse preserves quality gates and proof bridges

### Scenario: Packaged PreToolUse denies the same blocked edit as the legacy adapter

- [x] RED skip: focused scenario failed before the checkpoint commit; its test and implementation were consolidated to satisfy the LOC gate
- [x] GREEN 70f9ed72
- [x] REFACTOR skip: implementation change is a one-line constant with no duplication

### Scenario: Packaged PreToolUse records skill and review-stamp run identity

- [x] RED skip: focused scenario failed before the checkpoint commit; its test and implementation were consolidated to satisfy the LOC gate
- [x] GREEN 70f9ed72
- [x] REFACTOR skip: bridge cache write is shared with the existing run identity helper

### Scenario: Packaged PreToolUse preserves the shared shell safety gate

- [x] RED skip: focused RED was folded into the implementation checkpoint to satisfy the LOC gate
- [x] GREEN a73d0537
- [x] REFACTOR skip: the packaged adapter intentionally delegates to the existing shared hook

## Rule: codex-plugin-hook-parity.TB1.R2 - PostToolUse preserves quality state and language-skill nudges

### Scenario: Packaged PostToolUse accumulates quality state through the shared hook

- [x] RED skip: focused scenario failed before the checkpoint commit; its test and implementation were consolidated to satisfy the LOC gate
- [x] GREEN 70f9ed72
- [x] REFACTOR skip: package hook runner is shared for upcoming PostToolUse adapter calls

### Scenario: Packaged PostToolUse forwards language skill nudges

- [x] RED skip: focused scenario failed before the checkpoint commit; its test and implementation were consolidated to satisfy the LOC gate
- [x] GREEN 70f9ed72
- [x] REFACTOR skip: adapter runner already shared with PostToolUse quality path

### Scenario: Packaged PostToolUse stays quiet for edits without a language nudge

- [x] RED skip: paired with the positive-nudge RED in the same dispatcher slice
- [x] GREEN 70f9ed72
- [x] REFACTOR skip: no additional structure after shared adapter runner

## Rule: codex-plugin-hook-parity.TB1.R3 - Stop preserves continuations retro work and fail-open behavior

### Scenario: Packaged Stop emits architecture continuation before filing continuation

- [x] RED skip: focused scenario returned `{}` before the packaged Stop adapter was wired
- [x] GREEN 70f9ed72
- [x] REFACTOR skip: Stop reuses the shared package hook runner and needs no further extraction

### Scenario: Packaged Stop runs retro extraction invisibly

- [x] RED skip: the missing Stop adapter was established by the preceding architecture-precedence RED
- [x] GREEN 70f9ed72
- [x] REFACTOR skip: fixture-local fake CLI is the smallest deterministic extraction seam

### Scenario: Packaged Stop fails open with valid JSON

- [x] RED skip: malformed-input behavior is covered by the same previously missing Stop adapter boundary
- [x] GREEN 70f9ed72
- [x] REFACTOR skip: no additional behavior beyond the shared Stop response contract

## Rule: codex-plugin-hook-parity.TB1.R4 - SessionStart preserves package-owned context and auto-upgrade behavior through one dispatcher

### Scenario: Packaged SessionStart runs auto-upgrade before emitting package-owned SAFEWORD context

- [x] RED skip: focused scenario proved the old bundled-context shortcut before dispatcher wiring
- [x] GREEN 7d5d8561
- [x] REFACTOR skip: dispatcher stays package-owned and has one generated dependency seam

### Scenario: Packaged SessionStart includes upgrade notices without exit-code blocking

- [x] RED skip: focused scenario proved the old shortcut omitted the major-version notice
- [x] GREEN 7d5d8561
- [x] REFACTOR skip: notice serialization remains in the shared auto-upgrade core

## Rule: codex-plugin-hook-parity.TB1.R5 - UserPromptSubmit preserves timestamp, retro nudge, and queued prompt context

### Scenario: Packaged UserPromptSubmit emits timestamp and queued Safe Word prompt context

- [x] RED: packaged dispatch emitted neither the timestamp nor the retro-draft nudge after legacy cleanup
- [x] GREEN: one Codex response now merges the timestamp, an optional one-time packaged retro nudge, and optional project-owned queued context
- [x] REFACTOR: packaged-hook JSON parsing is fail-open so an advisory nudge never blocks a prompt

### Scenario: Packaged UserPromptSubmit emits a timestamp with no queued prompt context

- [x] RED: the legacy empty-queue assertion rejected the required timestamp context
- [x] GREEN: the scenario asserts structured UserPromptSubmit context containing `Current time:`
- [x] REFACTOR: timestamp formatting remains isolated from optional project context

## Rule: codex-plugin-hook-parity.SM1.R1 - The parity audit names every preserved redesigned and deferred behavior

### Scenario: Event-by-event parity map covers every legacy adapter behavior

- [x] RED skip: the parity-map artifact did not exist before this audit slice
- [x] GREEN 70f9ed72
- [x] REFACTOR skip: checked-in table is the simplest reviewable source of decisions

## Rule: codex-plugin-hook-parity.SM1.R2 - Deterministic tests prove every must-preserve behavior before live smoke

### Scenario: Plugin manifest commands all use the packaged hook command

- [x] RED skip: existing manifest already used the packaged command; this slice is characterization coverage
- [x] GREEN 70f9ed72
- [x] REFACTOR skip: no production change required

### Scenario: Hidden compatibility alias preserves the packaged hook contract

- [x] RED skip: hidden alias already delegated to the shared command implementation
- [x] GREEN 70f9ed72
- [x] REFACTOR skip: no production change required

## Rule: codex-plugin-hook-parity.SM1.R3 - Live smoke proves the trusted plugin path invokes the package command

### Scenario: Live vetted plugin run observes package-backed lifecycle dispatch

- [x] RED skip: isolated live-smoke fixture REDs were folded into the implementation checkpoint to satisfy the LOC gate
- [x] GREEN a73d0537
- [x] REFACTOR skip: the isolated marketplace and local CLI shim are test-only boundary infrastructure

## Feature-level cross-scenario refactor

- [x] cross-scenario 517177f8
