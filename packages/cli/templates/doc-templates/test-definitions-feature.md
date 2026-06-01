# Test Definitions: [Feature Name]

## Rule: [Business rule the scenarios below cover]

<!-- Scenario titles use the lineage scheme `<jtbd-id>.AC<#>.<scenario_name>`
     (snake_case) so `safeword check` maps each scenario to the AC it proves.
     See the bdd skill's SCENARIOS.md. -->

### Scenario: <jtbd-id>.AC<#>.<scenario_name>

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
