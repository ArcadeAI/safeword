# Test Definitions: Choose local or remote test execution per contributor

Feature source: `packages/cli/features/choose-local-or-remote-test-execution.feature`

## Rule: choose-local-or-remote-test-execution.TBU1.R1

### Scenario: A command override selects one local plan invocation and preserves its exit

- [x] RED 72ce94260
- [x] GREEN 0ed48f3a7
- [x] REFACTOR skip: parsing, execution, and exit delivery are already separated

### Scenario: A remote-preferred command override wins but falls back before dispatch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: choose-local-or-remote-test-execution.TBU1.R2

### Scenario: A personal preference chooses the current worktree default

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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
