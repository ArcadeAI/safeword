# Test Definitions: Split large contributions into independently reviewable PRs

Feature source: `features/split-large-contributions-into-reviewable-prs.feature`

test-definitions.md is the R/G/R ledger.

## Rule: plan-implementability.TBU2.6XW8H7.R1 — Execution Planning explicitly decides whether a large contribution needs multiple pull requests

### Scenario: Contribution shape produces an explicit slicing decision

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An omitted slicing decision cannot pass Execution Plan review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed review dispatch carries the canonical slicing contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU2.6XW8H7.R2 — Each planned pull request has one coherent purpose, boundary, prerequisite set, proof obligation, and completion signal and can be implemented without inventing a design decision

### Scenario: A complete pull-request slice receives a complete review record

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An incomplete pull-request slice is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A pull-request slice with two independent purposes is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A formally complete slice cannot leave a design decision to its implementer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU2.6XW8H7.R3 — Pull-request dependencies are ordered explicitly and every merge leaves the repository in a safe supported state

### Scenario: Ordered slices preserve a supported repository after every merge

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A slice that becomes safe only after a later merge is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU2.6XW8H7.R4 — Reviewable size is judged by conceptual scope and independent proof rather than line or file count alone

### Scenario: Conceptual scope determines reviewable slicing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Line count alone cannot justify a slicing decision

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU2.6XW8H7.R5 — PR slicing preserves every accepted behavior, migration, rollout, rollback, documentation, and affected-surface obligation without reopening the approach

### Scenario: Accepted obligations remain assigned across pull-request slices

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Accepted decisions remain unchanged across pull-request slices

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A slicing plan cannot discard an accepted obligation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A pull-request slice cannot rewrite an accepted approach decision

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
