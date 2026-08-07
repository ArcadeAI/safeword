# Test Definitions: Safeword recovery through dependency readiness

Feature source: `features/safeword-recovery-through-dependency-readiness.feature`

test-definitions.md is the R/G/R ledger.

## Rule: keep-safeword-recovery-runnable.TBU1.R1 — Safeword recovery remains reachable when dependency-backed commands are unavailable

### Scenario Outline: A recovery command remains available while dependencies are broken

- [x] RED bb8594419
- [x] GREEN e796293fa
- [x] REFACTOR skip: strict classifier is already small and names the recovery boundary directly

## Rule: keep-safeword-recovery-runnable.TBU1.R2 — The recovery exception does not make unrelated package executors runnable

### Scenario Outline: A non-recovery package command remains guarded

- [x] RED skip: shared classifier shipped in the prior slice; removing its metacharacter guard made five smuggling cases fail
- [x] GREEN b08fdb171
- [x] REFACTOR skip: table-driven adversarial cases share the existing classifier fixture without duplication

### Scenario: A newline cannot hide a guarded command after recovery

- [x] RED skip: the pre-existing shared shell splitter already treats newlines as command boundaries
- [x] GREEN b08fdb171
- [x] REFACTOR skip: newline coverage belongs in the existing command matrix and needs no separate fixture

## Rule: keep-safeword-recovery-runnable.TBU1.R3 — Recovery guidance names a command that the current CLI supports

### Scenario: Dogfood parity drift names the supported setup command

- [x] RED bdaf3525d
- [x] GREEN f8514616e
- [x] REFACTOR skip: formatter extraction already removed the duplicated failure-message assembly

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: independent whole-diff review found no cross-loop cleanup worth making

## Acceptance lane binding

- [x] RED ef075507f
- [x] GREEN 956889ad7
- [x] REFACTOR skip: shared fixture helpers keep the real-hook process setup in one place
