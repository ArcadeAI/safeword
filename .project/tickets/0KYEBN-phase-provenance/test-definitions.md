# Test Definitions: Phase provenance

Feature source: `features/phase-provenance.feature`

test-definitions.md is the R/G/R ledger.

## Rule: A feature ticket cannot silently begin life past intake

### Scenario: Born one phase past intake is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Born at intake is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Born with no phase recorded is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Non-feature tickets are born at any phase without objection

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A deliberate phase skip is explicit, per-phase, and stays visible in the ticket

### Scenario: Born past intake with every skipped phase justified is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A partial justification is denied naming only the unjustified phases

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A justification with an empty reason is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Phases advance one canonical step at a time

### Scenario: Advancing one canonical step is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A forward jump is denied naming every skipped phase

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A forward jump with every skipped phase justified is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Rework stays cheap — moving backward is never blocked

### Scenario: Moving backward for rework is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Off-sequence phase names cannot smuggle past the gate

### Scenario: Born at an unrecognized phase is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Advancing into an unrecognized phase is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A ticket already carrying an unrecognized phase advances as if from intake

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An edit that leaves an unrecognized phase untouched is ignored by the gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
