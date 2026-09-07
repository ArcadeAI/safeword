# Test Definitions: Stop hollow acceptance proofs before implementation

Feature source: `packages/cli/features/review-executable-red-before-implementation.feature`

test-definitions.md is the R/G/R ledger.

## Rule: executable-red.TBU1.R1 — Every distinct new or changed primary proof is independently executed before production implementation

### Scenario: A new primary proof is run from its captured pre-implementation state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Execution from a state containing the production implementation cannot earn RED approval

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

### Scenario: Execution with no selected primary test cannot earn RED approval

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

## Rule: executable-red.TBU1.R2 — RED is accepted only when the intended missing behavior fails through the stated actor boundary

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

### Scenario Outline: An interrupted proof run is not accepted as behavioral RED

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A narrower internal test is not accepted for an actor-boundary claim

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A proof of the wrong observable is not accepted for a scenario

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A result caused by leaked shared state is not accepted as behavioral RED

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: executable-red.TBU1.R3 — Material changes to the scenario, proof plan, test, glue, World, shared state, helpers, command, or evidence class invalidate the prior receipt

### Scenario Outline: A material proof input change makes the receipt stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An implementation-only change preserves the RED receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: executable-red.NTB1.R1 — A failed review explains the missing evidence and concrete next action in plain language

### Scenario Outline: A blocked proof distinguishes the cause and next action

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: executable-red.NTB1.R2 — Legitimate reuse does not create repetitive review ceremony

### Scenario: Scenario Outline rows sharing one proof implementation use one review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Distinct scenario proofs cannot share an umbrella receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: executable-red.SWM1.R1 — One review packet contains the scoped scenario or Rule body, proof-plan row, primary proof, glue, World definition, shared-state sources, helpers, exact command, full output, captured state, and evidence class

### Scenario Outline: The reviewer receives the complete proof contract and trusted execution together

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: An incomplete review packet is not dispatched

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: executable-red.SWM1.R2 — Trusted execution records and independent-review receipts carry authentic coordinator provenance

### Scenario: Authentic coordinator provenance is accepted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A fabricated execution record cannot become an approved receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A forged independent-review receipt cannot authorize GREEN

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An authentic receipt cannot be replayed onto another proof

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: executable-red.SWM1.R3 — Every supported agent host requires the same fresh, independently witnessed execution receipt before GREEN credit

### Scenario: The shared transition boundary blocks GREEN without a fresh RED receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The shared transition boundary permits GREEN with a fresh receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
