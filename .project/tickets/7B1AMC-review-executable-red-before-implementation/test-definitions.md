# Test Definitions: Stop hollow acceptance proofs before implementation

Feature source: `packages/cli/features/review-executable-red-before-implementation.feature`

test-definitions.md is the R/G/R ledger.

## Rule: executable-red.TBU1.R1 — Every new or changed primary proof is independently executed before implementation

### Scenario: A new primary proof is run from its captured pre-implementation state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A new proof with no trusted execution cannot earn RED approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Execution of an unrelated test cannot earn RED approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A non-independent verdict cannot earn a RED receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unavailable independent reviewer blocks RED approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: executable-red.TBU1.R2 — RED is accepted only for the intended missing behavior at the actor boundary

### Scenario: An assertion failure caused by the missing actor-visible behavior is accepted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A passing pre-implementation proof is not accepted as RED

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A setup failure is not accepted as behavioral RED

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An interrupted proof run is not accepted as behavioral RED

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A narrower internal test is not accepted for an actor-boundary claim

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: executable-red.TBU1.R3 — Material proof changes invalidate prior RED approval

### Scenario Outline: A material proof input change makes the receipt stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An implementation-only change preserves the RED receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: executable-red.NTB1.R1 — A failed gate explains the problem and next action plainly

### Scenario Outline: A blocked proof distinguishes the cause and recovery command

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: executable-red.NTB1.R2 — Legitimate proof reuse does not repeat review ceremony

### Scenario: Scenario Outline rows sharing one proof implementation use one review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Distinct scenario proofs cannot share an umbrella receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: executable-red.SWM1.R1 — The review packet carries complete execution evidence

### Scenario: The reviewer receives the proof contract and trusted execution together

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A fabricated execution record cannot become an approved receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: executable-red.SWM1.R2 — Every supported host enforces the same receipt before GREEN

### Scenario Outline: A host blocks GREEN when the RED receipt is absent or stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A fresh receipt permits GREEN through every supported host

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
