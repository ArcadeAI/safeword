# Test Definitions: Reuse monorepo architecture discovery

This task uses integration-level filesystem-boundary evidence because the
observable contract spans workspace discovery, model construction, target
enumeration, fingerprinting, and rendering. Tests use real collaborators and
spy only on Node's filesystem process boundary.

## Rule: One topology discovery per architecture operation

### Scenario: A readable workspace manifest is read once

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: An unreadable workspace manager is read once

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A readable zero-leaf workspace manager is probed once

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: One leaf skeleton extraction per architecture operation

### Scenario: A source header used for purpose seeding is read once

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Generated architecture behavior is unchanged

### Scenario: Existing architecture regression suites remain green

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Task-level cross-scenario refactor

- [x] cross-scenario 358566921
