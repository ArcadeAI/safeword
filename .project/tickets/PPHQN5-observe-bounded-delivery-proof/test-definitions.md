# Test definitions: Observe trustworthy current proof for contributors

Feature source: `features/observe-bounded-delivery-proof.feature`

These are new observer obligations, not reconstructed history for T3E4NS.
The demo retains its new RED evidence. GREEN and REFACTOR remain open;
no scenario completion or final actual-checkout proof is claimed.

## Scenario ledger

### Scenario: The observer runs the fixed proof set without changing the source checkout

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A caller cannot substitute an execution command

- [x] RED d6c9231aa
- [ ] GREEN
- [ ] REFACTOR

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
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unmapped delivery case prevents execution

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A required assertion without a passing result prevents success

- [ ] RED
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
