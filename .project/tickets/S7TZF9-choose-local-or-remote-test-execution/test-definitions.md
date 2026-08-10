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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: choose-local-or-remote-test-execution.TBU1.R3

### Scenario: Invalid personal configuration blocks a test request

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid personal configuration blocks a status request without mutation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: choose-local-or-remote-test-execution.NTB1.R1

### Scenario: Status explains the effective local decision without changing anything

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: choose-local-or-remote-test-execution.NTB1.R2

### Scenario: An unavailable remote preference uses the real local plan

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Public CLI grammar exposes only supported execution modes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
