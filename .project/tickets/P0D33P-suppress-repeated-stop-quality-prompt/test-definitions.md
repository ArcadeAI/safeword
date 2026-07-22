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

- [x] RED skip: shared recognizer was introduced by the prior CONFIDENT red slice before this independent verdict fixture
- [x] GREEN 4b948f508
- [x] REFACTOR skip: BLOCKED reuses the same ordered-marker helper without new structure

### Scenario: An out-of-order CONFIDENT brief is corrected

- [x] RED skip: the shared CONFIDENT grammar was already green before its independent ordering contract was added
- [ ] GREEN
- [ ] REFACTOR

## Rule: suppress-repeated-stop-quality-prompt.TBU1.R3 — Done-phase hard gates take precedence over a compliant brief

### Scenario: A complete brief cannot bypass a missing done-phase requirement

- [x] RED skip: the existing done gate already blocked this fixture before recognition was introduced; this is a characterization of required precedence
- [x] GREEN 4b948f508
- [x] REFACTOR skip: no structural change; the scenario protects branch ordering only

## Rule: suppress-repeated-stop-quality-prompt.TBU1.R2 — An incomplete decision brief still receives the corrective quality prompt

### Scenario: A response missing a required decision-brief field is corrected

- [x] RED skip: the existing corrective prompt already passed this incomplete fixture before recognition; characterization guards against a blanket allow
- [x] GREEN 4b948f508
- [x] REFACTOR skip: no structural change; the fixture shares the existing hook runner

## Feature-level cross-scenario refactor

- [ ] cross-scenario
