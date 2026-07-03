# Test Definitions: Phase provenance

Feature source: `features/phase-provenance.feature`

test-definitions.md is the R/G/R ledger.

## Rule: A feature ticket cannot silently begin life past intake

### Scenario: Born one phase past intake is denied

- [x] RED 13c6582
- [x] GREEN cccb3d9
- [x] REFACTOR skip: fresh 80-line lib, single branch, no duplication or naming debt yet

### Scenario: Born at intake is allowed

- [x] RED skip: allow-side landed inside scenario 1's minimal deny condition (cccb3d9); a failing test was never constructible
- [x] GREEN e0c1e5c
- [x] REFACTOR skip: no code change beyond the pin; nothing to restructure

### Scenario: Born with no phase recorded is allowed

- [x] RED skip: allow-side landed inside scenario 1's minimal deny condition (cccb3d9); a failing test was never constructible
- [x] GREEN e0c1e5c
- [x] REFACTOR skip: no code change beyond the pin; nothing to restructure

### Scenario: Non-feature tickets are born at any phase without objection

- [x] RED skip: exemption is the fresh gate's default-allow (type gate landed in cccb3d9); a failing test was never constructible
- [x] GREEN e0c1e5c
- [x] REFACTOR skip: no code change beyond the pin; nothing to restructure

### Scenario: A ticket.md with no type field is born at any phase without objection

- [x] RED skip: exemption is the fresh gate's default-allow (type gate landed in cccb3d9); a failing test was never constructible
- [x] GREEN e0c1e5c
- [x] REFACTOR skip: no code change beyond the pin; nothing to restructure

### Scenario: Non-feature tickets advance freely

- [x] RED skip: edit-path allow is the fresh gate's default; the unit pin (task intake→done stays ok) guards it once transition logic lands
- [x] GREEN e0c1e5c
- [x] REFACTOR skip: no code change beyond the pin; nothing to restructure

### Scenario: Changing a ticket's type to feature counts as a feature birth

- [x] RED 13c6582
- [x] GREEN 56a159e
- [x] REFACTOR skip: shared evaluateBirth landed clean; no duplication or naming debt to address

### Scenario: Adding type feature to a typeless ticket counts as a feature birth

- [x] RED 13c6582
- [x] GREEN 56a159e
- [x] REFACTOR skip: shared evaluateBirth landed clean; no duplication or naming debt to address

### Scenario: A type flip to feature at intake is allowed

- [x] RED skip: passed vacuously while the edit path was unimplemented; a failing test was not constructible without breaking sibling denies
- [x] GREEN 56a159e
- [x] REFACTOR skip: shared evaluateBirth landed clean; no duplication or naming debt to address

### Scenario: A type flip to feature past intake with every skipped phase justified is allowed

- [x] RED skip: passed vacuously while the edit path was unimplemented; a failing test was not constructible without breaking sibling denies
- [x] GREEN 56a159e
- [x] REFACTOR skip: shared evaluateBirth landed clean; no duplication or naming debt to address

### Scenario: A type flip at an unrecognized phase follows the counts-as-intake rule

- [x] RED skip: passed vacuously while the edit path was unimplemented; a failing test was not constructible without breaking sibling denies
- [x] GREEN 56a159e
- [x] REFACTOR skip: shared evaluateBirth landed clean; no duplication or naming debt to address

### Scenario: Repairing unparseable frontmatter into a feature past intake counts as a feature birth

- [x] RED 13c6582
- [x] GREEN 56a159e
- [x] REFACTOR skip: shared evaluateBirth landed clean; no duplication or naming debt to address

### Scenario: Repairing unparseable frontmatter into a feature at intake is allowed

- [x] RED skip: passed vacuously while the edit path was unimplemented; a failing test was not constructible without breaking sibling denies
- [x] GREEN 56a159e
- [x] REFACTOR skip: shared evaluateBirth landed clean; no duplication or naming debt to address

### Scenario: A ticket.md born without parseable frontmatter is denied

- [x] RED 13c6582
- [x] GREEN 92371f3
- [x] REFACTOR skip: two guard clauses, no structure to improve

### Scenario: A ticket.md born with frontmatter that does not parse is denied

- [x] RED 13c6582
- [x] GREEN 92371f3
- [x] REFACTOR skip: two guard clauses, no structure to improve

## Rule: A deliberate phase skip is explicit, per-phase, and stays visible in the ticket

### Scenario: Born past intake with every skipped phase justified is allowed

- [x] RED 13c6582
- [x] GREEN 56a159e
- [x] REFACTOR skip: shared evaluateBirth landed clean; no duplication or naming debt to address

### Scenario: A partial justification is denied naming only the unjustified phases

- [x] RED 13c6582
- [x] GREEN 56a159e
- [x] REFACTOR skip: shared evaluateBirth landed clean; no duplication or naming debt to address

### Scenario: A justification with an empty reason is denied

- [x] RED skip: passed coincidentally against the minimal gate's blanket deny; the partition is genuinely distinguished and unit-pinned at GREEN
- [x] GREEN 56a159e
- [x] REFACTOR skip: shared evaluateBirth landed clean; no duplication or naming debt to address

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

- [x] RED 13c6582
- [x] GREEN 56a159e
- [x] REFACTOR skip: shared evaluateBirth landed clean; no duplication or naming debt to address

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
