# Test Definitions: Trust executable RED before production implementation

Feature source: `packages/cli/features/review-executable-red-before-implementation.feature`

test-definitions.md is the R/G/R ledger.

## Rule: executable-red.TBU1.R1 — Safeword executes every distinct primary proof against sealed inputs

### Scenario: A real missing-behavior failure produces trusted execution evidence

- [x] RED 71b98fe8a
- [x] GREEN 6cfd94e48
- [x] REFACTOR 77ebbc9b1

### Scenario: Distinct primary proofs are executed separately

- [x] RED 250aee28a
- [x] GREEN 807a05dab
- [x] REFACTOR skip: canonical proof identity already separates materially different argv and targets

### Scenario: Author-supplied output cannot stand in for execution

- [x] RED 3d0fb3b4e
- [x] GREEN 25230ad98
- [x] REFACTOR skip: the packet boundary accepts only the worker-produced attestation

### Scenario: Modified execution evidence cannot stand in for the trusted attestation

- [x] RED 3d0fb3b4e
- [x] GREEN 25230ad98
- [x] REFACTOR skip: existing job-record HMAC validation is the shared tamper boundary

### Scenario: An interrupted proof is recorded but cannot earn approval

- [x] RED e4c622b52
- [x] GREEN 1d867be90
- [x] REFACTOR skip: platform-native process-tree termination is the smallest complete timeout boundary

## Rule: executable-red.TBU1.R2 — RED is accepted only for the intended missing behavior at the actor boundary

### Scenario: The intended actor-boundary assertion failure is accepted

- [x] RED skip: covered by the missing executable-RED rubric and packet contract
- [x] GREEN dd24f7558
- [x] REFACTOR skip: one generated fixed rubric owns failure-attribution policy

### Scenario: A passing proof cannot earn RED approval

- [x] RED d2a4dbb44
- [x] GREEN 8e05bf481
- [x] REFACTOR skip: passing, timed-out, and unmatched evidence share one qualifying-attestation predicate

### Scenario Outline: A wrong-reason failure is rejected

- [x] RED skip: covered by the missing executable-RED rubric and packet contract
- [x] GREEN dd24f7558
- [x] REFACTOR skip: rejection reasons remain a declarative rubric list rather than branching runtime code

## Rule: executable-red.TBU1.R3 — Material proof-input changes invalidate prior review

### Scenario Outline: A material proof input changes after approval

- [x] RED 71b98fe8a
- [x] GREEN 6cfd94e48
- [x] REFACTOR 77ebbc9b1

## Rule: executable-red.NTB1.R1 — Failed review explains the gap and the next action plainly

### Scenario: Unavailable independent review blocks GREEN approval

- [x] RED d2a4dbb44
- [x] GREEN 8e05bf481
- [x] REFACTOR skip: one public gate result owns the denial and recovery boundary

## Rule: executable-red.NTB1.R2 — Genuine shared proofs avoid repeated review ceremony

### Scenario: Scenario Outline rows share one proof implementation

- [x] RED skip: receipt reuse was absent until canonical proof identity was added
- [x] GREEN dd24f7558
- [x] REFACTOR skip: reuse is one HMAC-valid approved-job lookup keyed by the canonical fingerprint

### Scenario: Similar scenarios use materially different proof implementations

- [x] RED 250aee28a
- [x] GREEN 807a05dab
- [x] REFACTOR skip: distinct proof implementations naturally produce distinct canonical fingerprints

## Rule: executable-red.SWM1.R1 — Every agent sends one complete host-neutral RED review packet

### Scenario: Supported agents use the same trusted execution contract

- [x] RED 250aee28a
- [x] GREEN 807a05dab
- [x] REFACTOR dd24f7558

### Scenario: A supported agent omits a declared proof input

- [x] RED skip: regression proof added during verification after source-install scenario validation exposed the missing rejection example
- [x] GREEN 25230ad98
- [x] REFACTOR skip: the existing fingerprint contract already binds declared context content

## Rule: executable-red.SWM1.R2 — Receipt reuse follows distinct proof identity

### Scenario Outline: Proof identity determines receipt reuse

- [x] RED 71b98fe8a
- [x] GREEN 6cfd94e48
- [x] REFACTOR 77ebbc9b1

## Rule: executable-red.SWM1.R3 — Every supported host requires the same fresh receipt before GREEN

### Scenario Outline: Invalid executable-RED evidence blocks the shared GREEN transition

- [x] RED d2a4dbb44
- [x] GREEN 8e05bf481
- [x] REFACTOR skip: current fingerprint and sealed result validation already share one candidate path

### Scenario: Fresh exact executable-RED evidence permits the shared GREEN transition

- [x] RED d2a4dbb44
- [x] GREEN 8e05bf481
- [x] REFACTOR skip: the approved path is one small result constructor with no duplication

## Feature-level cross-scenario refactor

- [ ] cross-scenario
