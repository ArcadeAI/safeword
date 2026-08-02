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

- [x] RED 1da00bdb7
- [x] GREEN 325aa7d97
- [x] REFACTOR skip: eligibility table is already compact and exhaustive

### Scenario Outline: Spike execution stays question-sized

- [x] RED 8be3791d8
- [x] GREEN fd897c1ca
- [x] REFACTOR skip: three bullets match the three execution partitions directly

## Rule: spike-workflow.SWM1.R2 — evidence persists while experimental code stays disposable

### Scenario Outline: Every spike result feeds the production implementation plan

- [x] RED 22a67160e
- [x] GREEN ee7fb6636
- [x] REFACTOR skip: one report shape serves every terminal outcome

### Scenario: Spike code never becomes production implementation

- [x] RED 548a33ea1
- [x] GREEN e5e0248f0
- [x] REFACTOR skip: lifecycle guidance and real-git proof have distinct responsibilities

## Rule: spike-workflow.TBU1.R1 — supported hosts expose an explicit spike action

### Scenario: Setup installs the same spike action for project-scoped hosts

- [x] RED 5a3875ea0
- [x] GREEN 4c4f71d9b
- [x] REFACTOR skip: first vertical slice is already minimal and generator-owned

### Scenario: Catalogue generation ships the same spike action for Codex

- [x] RED skip: canonical-template parity generated Codex during the load-bearing setup slice
- [x] GREEN 6da2ce2f3
- [x] REFACTOR skip: generator proof uses the public catalogue writer directly

### Scenario: Host contracts keep spike behind explicit invocation

- [x] RED c67cb2386
- [x] GREEN c3b18bed9
- [x] REFACTOR skip: host-specific assertions make the soft and hard boundaries explicit

## Rule: spike-workflow.TBU1.R2 — BDD offers a spike only at the planning seam

### Scenario: Build-only kill risk is surfaced at the planning seam

- [x] RED 74e3f7edc
- [x] GREEN 1f4800037
- [x] REFACTOR skip: checkpoint stays inside the existing scenario-gate exit

### Scenario Outline: BDD does not offer a spike before behavior is validated

- [x] RED 3aa99b8e7
- [x] GREEN 6de669e9f
- [x] REFACTOR skip: phase-specific assertions keep the order contract readable

### Scenario: Routine features proceed without a spike

- [x] RED f11119812
- [x] GREEN 6d80a5793
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
