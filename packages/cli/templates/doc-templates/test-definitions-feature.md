# Test Definitions: [Feature Name]

## Rule: [Business rule the scenarios below cover]

### Scenario: [Name]

Given [context]
When [action]
Then [outcome]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: [Name]

Given [context]
When [action]
Then [outcome]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: [Another business rule]

### Scenario: [Name]

Given [context]
When [action]
Then [outcome]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

Marked at verify-phase: either `<sha>` (the refactor commit) or `skip: <non-empty reason>` (no shared fixtures or duplication emerged). The done-gate hard-blocks if this row is missing or has an empty skip reason on tickets that use the annotated checkbox format.

- [ ] cross-scenario
