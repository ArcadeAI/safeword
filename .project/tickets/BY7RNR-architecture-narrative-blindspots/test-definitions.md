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

### Scenario: An explicit configuration wins over a present root file even when its target is missing

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

### Scenario: An empty-string paths.architecture behaves as unconfigured

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

- [x] RED 5703f58
- [x] GREEN 9b7567d
- [x] REFACTOR skip: no structural change needed; feature-level pass at implement-exit

### Scenario: A configured narrative location is scanned instead of the root file

- [x] RED 5703f58
- [x] GREEN 9b7567d
- [x] REFACTOR skip: no structural change needed; feature-level pass at implement-exit

### Scenario: A long list of missing packages is capped with a tail count

- [x] RED 5703f58
- [x] GREEN 9b7567d
- [x] REFACTOR skip: no structural change needed; feature-level pass at implement-exit

### Scenario: A decision-record directory narrative is scanned across all records

- [x] RED a86dbd0
- [x] GREEN 9b7567d
- [x] REFACTOR skip: no structural change needed; feature-level pass at implement-exit

## Rule: A reconciled or absent narrative draws no drift advisory

### Scenario: A narrative mentioning every package stays silent

- [x] RED 5703f58
- [x] GREEN 9b7567d
- [x] REFACTOR skip: no structural change needed; feature-level pass at implement-exit

### Scenario: A package mentioned in any one decision record counts as mentioned

- [x] RED a86dbd0
- [x] GREEN 9b7567d
- [x] REFACTOR skip: no structural change needed; feature-level pass at implement-exit

### Scenario: A scoped package mentioned by its short name counts as mentioned

- [x] RED 5703f58
- [x] GREEN 9b7567d
- [x] REFACTOR skip: no structural change needed; feature-level pass at implement-exit

### Scenario: A project with no narrative anywhere stays silent

- [x] RED 5703f58
- [x] GREEN 9b7567d
- [x] REFACTOR skip: no structural change needed; feature-level pass at implement-exit

### Scenario: A single-repo modules map is never scanned for narrative drift

- [x] RED 5703f58
- [x] GREEN 9b7567d
- [x] REFACTOR skip: no structural change needed; feature-level pass at implement-exit

## Rule: The drift advisory never changes an exit code

### Scenario: A staleness check passes with current docs despite narrative drift

- [x] RED 5703f58
- [x] GREEN 9b7567d
- [x] REFACTOR skip: no structural change needed; feature-level pass at implement-exit

### Scenario: A staleness failure is still a staleness failure alongside narrative drift

- [x] RED a86dbd0
- [x] GREEN 9b7567d
- [x] REFACTOR skip: no structural change needed; feature-level pass at implement-exit

### Scenario: A commit-time stage run succeeds despite narrative drift

- [x] RED 5703f58
- [x] GREEN 9b7567d
- [x] REFACTOR skip: no structural change needed; feature-level pass at implement-exit
