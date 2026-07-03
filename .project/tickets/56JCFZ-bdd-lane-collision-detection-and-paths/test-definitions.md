# Test Definitions: Detect existing cucumber harness, configurable feature/step paths

Feature source: `packages/cli/features/bdd-lane-collision-detection-and-paths.feature`

test-definitions.md is the R/G/R ledger.

Deliberate coverage calls (scenario-gate 2026-07-03): `safeword check` as a
configured-paths reader is proven via the shared `feature-source.ts` choke point
(sole discovery used by codify/lint-gherkin/check) plus feature-source unit
tests — no separate check E2E scenario. A cucumber config *file* inside a
workspace package is covered by the union of the root-config-file and
workspace-dep scenarios (detection unions signals × radii); accepted, revisit if
detection stops being a union.

## Rule: Setup never scaffolds a second harness

### Scenario: Setup skips the starter lane when a root cucumber config exists

- [x] RED 8c855fc
- [x] GREEN bb7f8c5
- [x] REFACTOR skip: no structural improvement needed — reused existing generator-skip and conditional-package mechanisms

### Scenario: Setup skips the starter lane when a workspace package depends on cucumber

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Setup skips the starter lane when a customer-authored cucumber.mjs exists

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Setup skips the starter lane when only a root cucumber dependency exists

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Setup scaffolds the starter lane when no cucumber exists anywhere

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Safeword never mistakes its own scaffold for a host harness

### Scenario: Upgrade keeps maintaining the lane safeword installed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Upgrade recognizes a previous template revision as its own scaffold

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Upgrade on a bitten repo maintains safeword's lane without touching the host harness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Uninstall removes only what safeword owns

### Scenario: Reset leaves a host harness untouched

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Full uninstall never deletes files at configured paths locations

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Configured paths augment discovery for safeword's readers

### Scenario: Codify finds a ticket's feature source in a configured directory

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Lint-gherkin lints configured and default directories together

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unparseable config file falls back to default discovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The scaffolded runner honors configured paths

### Scenario: A real cucumber-js run executes features from configured directories

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The runner behaves exactly as today when no config file exists

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The runner falls back to default directories when the config file is unparseable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Check advisories name misalignment without editing anything

### Scenario: Check warns when a harness is detected and paths are unset

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Check stays silent when safeword's own lane is the only harness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Check stays silent once configured paths point at the detected harness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Check enumerates a leftover duplicate scaffold without touching it

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
