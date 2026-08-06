# Test Definitions: Safeword recovery through dependency readiness

Feature source: `features/safeword-recovery-through-dependency-readiness.feature`

test-definitions.md is the R/G/R ledger.

## Rule: keep-safeword-recovery-runnable.TBU1.R1 — Safeword recovery remains reachable when dependency-backed commands are unavailable

### Scenario Outline: A recovery command remains available while dependencies are broken

- [x] RED 08cc2f278
- [x] GREEN 849e93605
- [x] REFACTOR skip: strict classifier is already small and names the recovery boundary directly

## Rule: keep-safeword-recovery-runnable.TBU1.R2 — The recovery exception does not make unrelated package executors runnable

### Scenario Outline: A non-recovery package command remains guarded

- [x] RED skip: shared classifier shipped in the prior slice; removing its metacharacter guard made five smuggling cases fail
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A newline cannot hide a guarded command after recovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: keep-safeword-recovery-runnable.TBU1.R3 — Recovery guidance names a command that the current CLI supports

### Scenario: Dogfood parity drift names the supported setup command

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
