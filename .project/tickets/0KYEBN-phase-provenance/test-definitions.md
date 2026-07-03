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

### Scenario: A ticket.md with no type field is born at any phase without objection

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Non-feature tickets advance freely

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Changing a ticket's type to feature counts as a feature birth

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Adding type feature to a typeless ticket counts as a feature birth

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A type flip to feature at intake is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A type flip to feature past intake with every skipped phase justified is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A type flip at an unrecognized phase follows the counts-as-intake rule

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Repairing unparseable frontmatter into a feature past intake counts as a feature birth

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Repairing unparseable frontmatter into a feature at intake is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A ticket.md born without parseable frontmatter is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A ticket.md born with frontmatter that does not parse is denied

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

### Scenario: The maximal jump names every skipped phase

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A forward jump with every skipped phase justified is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A ticket with no phase field counts as intake when a phase is added

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Rework and routine edits stay cheap — the gate never blocks them

### Scenario: Moving backward for rework is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An edit that leaves a canonical phase untouched is ignored by the gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An edit that leaves unparseable frontmatter untouched is ignored by the gate

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

### Scenario: A ticket carrying an unrecognized phase cannot jump forward as if from intake

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An edit that leaves an unrecognized phase untouched is ignored by the gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
