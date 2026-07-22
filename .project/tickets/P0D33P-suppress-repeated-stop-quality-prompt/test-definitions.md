# P0D33P — Test Definitions

Feature source: `features/suppress-repeated-stop-quality-prompt.feature`

The feature source is deliberately `@manual`: the acceptance proof drives the
real hook with fixture stdin under Vitest, where Stop payload and output can be
deterministically controlled.

## Rule: suppress-repeated-stop-quality-prompt.TBU1.R1 — A compliant decision brief does not trigger another quality prompt

### Scenario: A complete CONFIDENT brief completes the edited-work stop

- [x] RED af8c5303d
- [x] GREEN 6f950b16e
- [x] REFACTOR skip: ordered marker helper already removes the shared grammar duplication

### Scenario: A complete BLOCKED brief completes the edited-work stop

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: suppress-repeated-stop-quality-prompt.TBU1.R3 — Done-phase hard gates take precedence over a compliant brief

### Scenario: A complete brief cannot bypass a missing done-phase requirement

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: suppress-repeated-stop-quality-prompt.TBU1.R2 — An incomplete decision brief still receives the corrective quality prompt

### Scenario: A response missing a required decision-brief field is corrected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
