# Test Definitions: Filer ack + bare-drain tripwire

Feature source: `packages/cli/features/filer-ack-tripwire.feature` (@manual —
vitest-proven). Spec: `spec.md`. Dimensions: `dimensions.md`.

test-definitions.md is the R/G/R ledger. RED means an EXECUTED failing run
(command + failure observed), not an asserted counterfactual.

## Rule: Unacked removals trip once per batch; acked removals stay silent

### Scenario: A dispatched signature vanishing without an ack captures one RetroBareDrain signal (SM1.AC1, TB1.AC1)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A tripped batch does not trip again (SM1.AC1)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Removals covered by shape-valid ack lines trip nothing (SM1.AC2)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Malformed ack lines are skipped without crashing or false-acking (SM1.AC2)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Absent or pre-upgrade state fails open

### Scenario: A GH628F-era marker without a signature snapshot disarms the tripwire (SM1.AC3)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Capture-off suppresses the tripwire (SM1.AC3)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The filer acks before it drains

### Scenario: The filing seam records an ack per successful post before draining (SM2.AC2)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Shipped prompts carry the ack procedure and drain prohibition (SM2.AC1)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
