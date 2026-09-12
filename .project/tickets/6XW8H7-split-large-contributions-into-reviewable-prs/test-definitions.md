# Test Definitions: Split large contributions into independently reviewable PRs

Feature source: `features/split-large-contributions-into-reviewable-prs.feature`

test-definitions.md is the R/G/R ledger.

## Rule: plan-implementability.TBU2.6XW8H7.R1 — Execution Planning explicitly decides whether a large contribution needs multiple pull requests

### Scenario: Contribution shape produces an explicit slicing decision

- [x] RED — be9e664ac
- [x] GREEN — f6e67f8ad
- [x] REFACTOR — 1c4d56d07

### Scenario: An omitted slicing decision cannot pass Execution Plan review

- [x] RED — 238f2e4f4
- [x] GREEN — 596886398
- [x] REFACTOR — f6e67f8ad

### Scenario: Installed review dispatch carries the canonical slicing contract

- [x] RED — 2f81f4a6b
- [x] GREEN — 1c4d56d07
- [x] REFACTOR — 1c4d56d07

## Rule: plan-implementability.TBU2.6XW8H7.R2 — Each planned pull request has one coherent purpose, boundary, prerequisite set, proof obligation, and completion signal and can be implemented without inventing a design decision

### Scenario: A complete pull-request slice receives a complete review record

- [x] RED — be9e664ac
- [x] GREEN — 31c78b6f1
- [x] REFACTOR — 1c4d56d07

### Scenario: An incomplete pull-request slice is rejected

- [x] RED — be9e664ac
- [x] GREEN — 31c78b6f1
- [x] REFACTOR — 1c4d56d07

### Scenario: A pull-request slice with two independent purposes is rejected

- [x] RED — 238f2e4f4
- [x] GREEN — 596886398
- [x] REFACTOR — f6e67f8ad

### Scenario: A formally complete slice cannot leave a design decision to its implementer

- [x] RED — 238f2e4f4
- [x] GREEN — 596886398
- [x] REFACTOR — f6e67f8ad

## Rule: plan-implementability.TBU2.6XW8H7.R3 — Pull-request dependencies are ordered explicitly and every merge leaves the repository in a safe supported state

### Scenario: Ordered slices preserve a supported repository after every merge

- [x] RED — 238f2e4f4
- [x] GREEN — 596886398
- [x] REFACTOR — f6e67f8ad

### Scenario: A slice that becomes safe only after a later merge is rejected

- [x] RED — 238f2e4f4
- [x] GREEN — 596886398
- [x] REFACTOR — f6e67f8ad

## Rule: plan-implementability.TBU2.6XW8H7.R4 — Reviewable size is judged by conceptual scope and independent proof rather than line or file count alone

### Scenario: Conceptual scope determines reviewable slicing

- [x] RED — 238f2e4f4
- [x] GREEN — 596886398
- [x] REFACTOR — f6e67f8ad

### Scenario: Line count alone cannot justify a slicing decision

- [x] RED — 238f2e4f4
- [x] GREEN — 596886398
- [x] REFACTOR — f6e67f8ad

## Rule: plan-implementability.TBU2.6XW8H7.R5 — PR slicing preserves every accepted behavior, migration, rollout, rollback, documentation, and affected-surface obligation without reopening the approach

### Scenario: Accepted obligations remain assigned across pull-request slices

- [x] RED — 238f2e4f4
- [x] GREEN — 596886398
- [x] REFACTOR — f6e67f8ad

### Scenario: Accepted decisions remain unchanged across pull-request slices

- [x] RED — 238f2e4f4
- [x] GREEN — 596886398
- [x] REFACTOR — f6e67f8ad

### Scenario: A slicing plan cannot discard an accepted obligation

- [x] RED — 238f2e4f4
- [x] GREEN — 596886398
- [x] REFACTOR — f6e67f8ad

### Scenario: A pull-request slice cannot rewrite an accepted approach decision

- [x] RED — 238f2e4f4
- [x] GREEN — 596886398
- [x] REFACTOR — f6e67f8ad
