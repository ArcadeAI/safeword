# Test Definitions: add-spike-workflow

Feature source: `features/add-spike-workflow.feature`

test-definitions.md is the R/G/R ledger.

## Rule: spike-workflow.SWM1.R1 — a spike is bounded before code is written

### Scenario: Eligible uncertainty starts with a complete experiment charter

- [x] RED 617fd7964
- [x] GREEN 1ad07d80f
- [x] REFACTOR skip: five-field list is the smallest readable contract

### Scenario Outline: An incomplete charter cannot execute

- [x] RED 4280854f8
- [x] GREEN cc6786238
- [x] REFACTOR skip: one guard clause expresses the whole rejection boundary

### Scenario Outline: Non-executable uncertainty is routed without a spike

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Spike execution stays question-sized

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: spike-workflow.SWM1.R2 — evidence persists while experimental code stays disposable

### Scenario Outline: Every spike result feeds the production implementation plan

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Spike code never becomes production implementation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: spike-workflow.TBU1.R1 — supported hosts expose one manual action

### Scenario: Setup installs the same spike action for project-scoped hosts

- [x] RED 5a3875ea0
- [x] GREEN 4c4f71d9b
- [x] REFACTOR skip: first vertical slice is already minimal and generator-owned

### Scenario: Catalogue generation ships the same spike action for Codex

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Automatic skill selection cannot spend a spike budget

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: spike-workflow.TBU1.R2 — BDD offers a spike only at the planning seam

### Scenario: Build-only kill risk is surfaced at the planning seam

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: BDD does not offer a spike before behavior is validated

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Routine features proceed without a spike

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
