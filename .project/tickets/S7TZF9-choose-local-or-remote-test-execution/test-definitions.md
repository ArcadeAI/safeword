# Test Definitions: Choose local or remote test execution per contributor

Feature source: `packages/cli/features/choose-local-or-remote-test-execution.feature`

## Rule: choose-local-or-remote-test-execution.TBU1.R1

### Scenario: A command override selects one local plan invocation and preserves its exit

- [x] RED 72ce94260
- [x] GREEN 0ed48f3a7
- [x] REFACTOR skip: parsing, execution, and exit delivery are already separated

### Scenario: A remote-preferred command override wins but falls back before dispatch

- [x] RED 2bc4d1563
- [x] GREEN 8180a8047
- [x] REFACTOR skip: fallback decision and plan execution are already isolated

## Rule: choose-local-or-remote-test-execution.TBU1.R2

### Scenario: A personal preference chooses the current worktree default

- [x] RED skip: precedence behavior already existed from the status slice
- [x] GREEN 589c612b9
- [x] REFACTOR skip: the two modes share one parameterized behavior test

### Scenario: A personal preference is not shared with another worktree

- [x] RED skip: cwd-scoped resolution already isolated each worktree
- [x] GREEN ebec2f1d1
- [x] REFACTOR skip: one paired test proves both worktree decisions

## Rule: choose-local-or-remote-test-execution.TBU1.R3

### Scenario: Invalid personal configuration blocks a test request

- [x] RED ee2b791c6
- [x] GREEN dbcc69d0a
- [x] REFACTOR skip: file, Git, and schema checks are isolated validation steps

### Scenario: Invalid personal configuration blocks a status request without mutation

- [x] RED skip: status already failed closed for malformed JSON
- [x] GREEN 2a94a8d68
- [x] REFACTOR skip: the existing status path shares the strict config reader

## Rule: choose-local-or-remote-test-execution.NTB1.R1

### Scenario: Status explains the effective local decision without changing anything

- [x] RED skip: status behavior predates the current TDD continuation
- [x] GREEN b1ff687fb4
- [x] REFACTOR skip: status delegates to the shared precedence resolver

## Rule: choose-local-or-remote-test-execution.NTB1.R2

### Scenario: An unavailable remote preference uses the real local plan

- [x] RED skip: shared fallback implementation already covered command selection
- [x] GREEN 580eb75a8
- [x] REFACTOR skip: one matrix covers project and personal sources across both lanes

### Scenario: Public CLI grammar exposes only supported execution modes

- [x] RED 555a950ee
- [x] GREEN 12e881859
- [x] REFACTOR skip: option accumulation is isolated in one parser strategy

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: shared parsing, precedence, decision, and plan helpers already serve every scenario
