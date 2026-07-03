# Test Definitions: Artifact precedence — the behavior chain is earned, not ticked

Feature source: `features/artifact-precedence-gate.feature`

test-definitions.md is the R/G/R ledger. Scenario names mirror the feature source; lineage lives in its `@artifact-precedence-gate.*` tags.

## Rule: An artifact cannot be created before its prerequisites are complete

### Scenario: spec.md created in a folder with no ticket.md is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: spec.md created alongside an existing ticket.md is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: dimensions.md created before spec.md exists is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: dimensions.md created on a spec with no resolvable job is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: dimensions.md created on a spec whose job lacks acceptance criteria is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: dimensions.md created on a complete spec is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: dimensions.md created on a spec carrying a deliberate jobs skip is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Non-feature tickets create dimensions.md without objection (task / patch / epic)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A ticket.md with no type field creates dimensions.md without objection

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Scenarios build only on a reviewed spec

### Scenario: Scenario authoring with no spec review stamp is denied even with the review gate flag off

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Scenario authoring with a review stamp at the spec's current content is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A spec edited after its review no longer satisfies the demand

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A logged review skip with a reason satisfies the demand

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A logged review skip with an empty reason does not satisfy the demand

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Another ticket's review stamp does not satisfy even at identical spec content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Task tickets author test definitions without a spec review stamp

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Implementation starts only on independently reviewed scenarios

### Scenario: Advancing into implement with no scenario review stamp is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Advancing into implement with a scenario review stamp at current content is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Scenarios edited after their review no longer satisfy the demand

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The scenario review binds to the feature source when the ledger names one

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The scenario review binds to the ledger when no feature source is named

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A logged scenario review skip with a reason satisfies the demand

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A logged scenario review skip with an empty reason does not satisfy the demand

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A ledger stamp does not satisfy when the ledger names a feature source

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An implement advance via MultiEdit is gated like an Edit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A phase_skips justification covering scenario-gate satisfies the demand

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Advancing into implement with no scenario artifact is denied naming the artifact first

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Non-feature tickets advance into implement without objection

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Every denial names the earliest missing prerequisite and the forward next action

### Scenario: With both spec.md and dimensions.md missing the denial names spec.md first

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: With spec.md complete and dimensions.md missing the denial names dimensions.md

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Precedence denials carry the ordered-patch recovery note

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Rework and routine writes stay cheap — the gates never block them

### Scenario: Editing an existing dimensions.md under an incomplete spec is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Editing an existing test-definitions.md without a spec review stamp is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A ticket.md edit that does not change phase is ignored by the review demand

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Moving backward out of implement is allowed without any stamp

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Advancing from implement to verify demands no scenario review stamp

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A spec.md outside the tickets namespace is ignored

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A dimensions.md outside the tickets namespace is ignored

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
