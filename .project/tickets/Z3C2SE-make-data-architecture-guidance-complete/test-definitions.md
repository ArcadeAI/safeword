# Test Definitions: Complete conditional data architecture guidance

Feature source: `features/make-data-architecture-guidance-complete.feature`

This file is the R/G/R progress ledger. The feature file is the behavior source of truth.

## Rule: data-architecture-guidance.TBU1.R1 — Consequential data contracts are recorded while reversible code-local choices remain in implementation planning

### Scenario: A mixed planning case keeps durable decisions separate from reversible helpers

- [x] RED 6ff225ad5
- [x] GREEN 945552266
- [x] REFACTOR skip: canonical binding checks and exact-set grading are already isolated with no behavior-preserving simplification left

### Scenario: Treating a consequential data contract as a reversible helper fails review

- [x] RED 6ff225ad5
- [x] GREEN 945552266
- [x] REFACTOR skip: the shared exact-set grader already reports the missing durable decision directly with no scenario-specific branch to simplify

## Rule: data-architecture-guidance.TBU1.R2 — Every plan answers the applicable universal questions and invokes only the conditional modules whose triggers fire

### Scenario Outline: Each representative case selects exactly its applicable guidance

- [x] RED 3bc52596e
- [x] GREEN c56da116a
- [x] REFACTOR skip: the corpus verifier is a single stable-order delegation to the existing record verifier with no duplicated grading logic to simplify

### Scenario Outline: Invalid evaluation records fail deterministic verification

- [x] RED d9a8274ad
- [x] GREEN c56da116a
- [x] REFACTOR skip: invalid-record diagnostics reuse the same record verifier and stable case-prefix path without scenario-specific branching

## Rule: data-architecture-guidance.TBU1.R3 — Architecture, implementation plans, generated representations, ADRs, and linked evidence each retain a single explicit responsibility

### Scenario: The artifact-ownership case assigns each decision to one owner

- [x] RED d1ab3fd7b
- [x] GREEN c56da116a
- [x] REFACTOR skip: ownership uses the shared exact-set corpus path and adds no ownership-specific implementation branch to simplify

### Scenario: Duplicating a contract as authority across artifacts fails review

- [x] RED fd644bd7a
- [x] GREEN 9041ba23f
- [ ] REFACTOR

## Rule: data-architecture-guidance.TBU2.R1 — Every completeness claim names an oracle independent of the mechanism being checked

### Scenario: An independent facet inventory exposes an omitted generated-manifest facet

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Agreement between sibling generated outputs cannot prove completeness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A discriminating guide-ablation pair validates independent proof

- [x] RED 6c8a58562
- [x] GREEN a2c4a49b2
- [x] REFACTOR skip: verifier responsibilities are already isolated; the test edit belongs to a separate bootstrap-hang fix found by scenario-close verification

### Scenario Outline: A non-discriminating guide-ablation pair fails evaluation

- [x] RED ee4d80dde
- [x] GREEN fda0a5e14
- [x] REFACTOR skip: independent review strengthened the verifier; no further behavior-preserving refactor remained

## Rule: data-architecture-guidance.TBU2.R2 — Conditional proof includes the environment, boundaries, controls, and revalidation conditions needed to falsify the claim

### Scenario Outline: Conditional claims carry the facts that make them falsifiable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A non-discriminating proof fails with a focused diagnostic

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: data-architecture-guidance.TBU2.R3 — Proof uses synthetic or read-only evidence and never requires secrets, plaintext customer data, or production credentials

### Scenario: Synthetic placeholders and deployed read-only snapshots satisfy evidence needs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Sensitive-looking evaluation values are refused

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: data-architecture-guidance.SWM1.R1 — Installed and generated guide paths match an independent inventory and every planning reference resolves

### Scenario: Supported hosts resolve one coherent guide through their existing delivery model

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Shipped guide drift fails delivery verification

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
