# Test Definitions: Keep optional lint sections from failing nonmatching projects

This task's behavioral scenarios and RED/GREEN/REFACTOR evidence are defined in `ticket.md` under **Test Definitions**. This ledger mirrors their completion state for Safeword phase and done-gate checks.

## Rule: Optional language sections do not determine an otherwise-successful lint run

### Scenario: JavaScript-only lint instructions complete successfully

- [x] RED: focused contract failed five JavaScript-only surfaces with status 1
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Go lint instructions remain conditional on a Go manifest

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Cross-scenario refactor

- [ ] cross-scenario
