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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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
- [ ] REFACTOR

### Scenario: A required assertion without a passing result prevents success

- [x] RED 561cdb715
- [ ] GREEN
- [ ] REFACTOR

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
