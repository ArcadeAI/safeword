# Test Definitions: Architecture narrative blind spots (BY7RNR)

Feature source: `features/architecture-narrative-blindspots.feature`

test-definitions.md is the R/G/R ledger. TB1 rules are proven in the vitest hook
lane (git-backed integration + differential parity, `@wip` in cucumber); TB2
rules run in the cucumber acceptance lane against the real CLI.

## Rule: The done-gate nudge resolves the narrative via paths.architecture

### Scenario: A configured non-root narrative gets the nudge when a ticket moves the shape

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A configured decision-record directory counts as a narrative

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A configured narrative that is missing on disk draws no advisory

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Unconfigured hosts keep today's root-ARCHITECTURE.md behavior exactly

### Scenario: An unconfigured host with a root ARCHITECTURE.md still nudges on shape movement

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unconfigured host with no narrative anywhere stays silent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unchanged fingerprint stays silent even with a configured narrative

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unparseable config falls back to the root ARCHITECTURE.md

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The advisory names the narrative it is asking the builder to reconcile

### Scenario: A configured narrative is named in the advisory text

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The root fallback is named as ARCHITECTURE.md

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The installed prompts direct agents to the configured narrative

### Scenario: The architecture review prompt resolves the narrative via paths.architecture

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The audit skill's structural-drift check resolves the narrative via paths.architecture

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Generated packages absent from the narrative are surfaced on every architecture run

### Scenario: Packages the narrative never mentions are named in the run output

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A configured narrative location is scanned instead of the root file

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A long list of missing packages is capped with a tail count

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A reconciled or absent narrative draws no drift advisory

### Scenario: A narrative mentioning every package stays silent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A scoped package mentioned by its short name counts as mentioned

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A project with no narrative anywhere stays silent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A single-repo modules map is never scanned for narrative drift

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The drift advisory never changes an exit code

### Scenario: A staleness check passes with current docs despite narrative drift

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A commit-time stage run succeeds despite narrative drift

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
