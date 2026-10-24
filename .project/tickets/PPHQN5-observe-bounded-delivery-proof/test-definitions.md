# Test definitions: Observe trustworthy current proof for contributors

Feature source: `features/observe-bounded-delivery-proof.feature`

These are new observer obligations, not reconstructed history for T3E4NS.
The caller-override and complete-proof demo have new observer evidence.
Other scenarios remain open; no final actual-checkout proof is claimed.

## Scenario ledger

### Scenario: The observer runs the fixed proof set without changing the source checkout

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A caller cannot substitute an execution command

- [x] RED d6c9231aa
- [x] GREEN c9665017f
- [x] REFACTOR skip: parser refusal stays feature-local; 49 regression tests and three real entrypoint checks pass, with no additional structural change needed

### Scenario: Uncommitted execution inputs prevent observation

The accepted CLI surface and recovery plan require one concrete fixed observation
request after commit-or-clean instructions. The human proof checks that action;
the JSON Cucumber control separately checks that execution never starts.

- [x] RED 1be7378a6
- [x] GREEN 6d93f43cc
- [x] REFACTOR skip: human refusal and fixed recovery remain feature-local; the real human control and 52 focused tests passed, with no further structural cleanup warranted; later identity and lock corrections require behavioral test edits in GREEN

### Scenario: A candidate change during execution prevents a successful observation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Complete fixed-lane execution produces verifiable current evidence

- [x] RED 9dec94696
- [x] GREEN 92f4d17e1
- [x] REFACTOR skip: tool details and isolated version probes stay feature-local; 49 focused tests, three entrypoint checks and the ordinary suite passed, including 11804 CLI tests across 728 files, with no further structural change warranted

### Scenario: An unmapped delivery case prevents execution

- [x] RED 4e8207dc7
- [x] GREEN dfc49fb24
- [x] REFACTOR skip: the independent case census and named unsupported-case diagnostic need no additional abstraction; the built-artifact control and bound Cucumber case passed

### Scenario: A required assertion without a passing result prevents success

- [x] RED 561cdb715
- [x] GREEN dfc49fb24
- [x] REFACTOR skip: one grader and one named diagnostic cover absent, skipped and failed outcomes; all three actual CLI controls passed, and no further structural change is warranted

### Scenario: A failed runner cannot hide behind passing assertions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Altered report bytes cannot verify as observed proof

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Retrying an interrupted attempt preserves the failed evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Observation currency follows meaningful input changes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Successful observation leaves historical and completion authority unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Cross-scenario review and refactor

- [ ] cross-scenario
