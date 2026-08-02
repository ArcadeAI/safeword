# Test Definitions: add-spike-workflow

Feature source: `features/add-spike-workflow.feature`

test-definitions.md is the R/G/R ledger.

## Rule: spike-workflow.SWM1.R1 — a spike is bounded before code is written

### Scenario: Eligible uncertainty starts with a complete experiment charter

- [x] RED 4a14b3110
- [x] GREEN 7e862a7b2
- [x] REFACTOR skip: five-field list is the smallest readable contract

### Scenario Outline: An incomplete charter cannot execute

- [x] RED b6644b5b2
- [x] GREEN bad586383
- [x] REFACTOR skip: one guard clause expresses the whole rejection boundary

### Scenario Outline: Non-executable uncertainty is routed without a spike

- [x] RED 31600e087
- [x] GREEN 114d39694
- [x] REFACTOR skip: eligibility table is already compact and exhaustive

### Scenario Outline: Spike execution stays question-sized

- [x] RED 90aab2560
- [x] GREEN b411d3e19
- [x] REFACTOR skip: three bullets match the three execution partitions directly

## Rule: spike-workflow.SWM1.R2 — evidence persists while experimental code stays disposable

### Scenario Outline: Every spike result produces a structured planning handoff

- [x] RED ba633d4ab
- [x] GREEN 19c3e8a88
- [x] REFACTOR skip: one report shape serves every terminal outcome

### Scenario: Planning consumes the spike handoff after creating its design record

- [x] RED 0eb6a2a18
- [x] GREEN 149e382fe
- [x] REFACTOR skip: the explicit mapping table is the smallest value-carrying handoff contract

### Scenario Outline: Dirty validated state cannot become the pre-spike base

- [x] RED fcd791c8e
- [x] GREEN 095bcfde3
- [x] REFACTOR skip: one fail-closed guard protects both validated-state inputs

### Scenario: Committed validated state becomes the shared spike base

- [x] RED 67ca2f49e
- [x] GREEN 13d081d8e
- [x] REFACTOR skip: one post-creation verification covers commit identity and validated files

### Scenario: Reviewed spike planning reaches production without experimental history

- [x] RED df7cb9402
- [x] GREEN ac6a719b1
- [x] REFACTOR skip: one integrated real-Git scenario is the smallest proof of the complete evidence chain

### Scenario: Spike code never becomes production implementation

- [x] RED 9c5c91335
- [x] GREEN f50737dbe
- [x] REFACTOR skip: lifecycle guidance and real-git proof have distinct responsibilities

## Rule: spike-workflow.TBU1.R1 — supported hosts expose an explicit spike action

### Scenario: Setup installs the same spike action for project-scoped hosts

- [x] RED 7359d349c
- [x] GREEN 66185ea05
- [x] REFACTOR skip: first vertical slice is already minimal and generator-owned

### Scenario: Catalogue generation ships the same spike action for Codex

- [x] RED skip: canonical-template parity generated Codex during the load-bearing setup slice
- [x] GREEN 88bb5c7af
- [x] REFACTOR skip: generator proof uses the public catalogue writer directly

### Scenario: Host contracts keep spike behind explicit invocation

- [x] RED c823d5d11
- [x] GREEN 5cd985730
- [x] REFACTOR skip: host-specific assertions make the soft and hard boundaries explicit

### Scenario: Spike proof commands retain normal permission prompts

- [x] RED a397f1e95
- [x] GREEN a12f7c52a
- [x] REFACTOR skip: deleting blanket preapproval is the complete minimal change

## Rule: spike-workflow.TBU1.R2 — BDD offers a spike only at the planning seam

### Scenario: Build-only kill risk is surfaced at the planning seam

- [x] RED a9521f403
- [x] GREEN bf0a14be5
- [x] REFACTOR skip: checkpoint stays inside the existing scenario-gate exit

### Scenario Outline: BDD does not offer a spike before behavior is validated

- [x] RED f208b9405
- [x] GREEN b0c0a0495
- [x] REFACTOR skip: phase-specific assertions keep the order contract readable

### Scenario: Routine features proceed without a spike

- [x] RED 95a64fdc2
- [x] GREEN d5c23c808
- [x] REFACTOR skip: explicit no-risk branch is a single readable sentence

---

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: whole-ticket review found the existing real-git helpers and contract assertions cohesive, with no shared cleanup worth another abstraction
