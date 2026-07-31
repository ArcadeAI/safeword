# Test Definitions: Keep optional lint sections from failing nonmatching projects

This task's behavioral scenarios and RED/GREEN/REFACTOR evidence are defined in `ticket.md` under **Test Definitions**. This ledger mirrors their completion state for Safeword phase and done-gate checks.

## Rule: Optional language sections do not determine an otherwise-successful lint run

### Scenario: JavaScript-only lint instructions complete successfully

- [x] RED skip: focused contract failed five JavaScript-only surfaces with status 1
- [x] GREEN d07030c36
- [x] REFACTOR skip: each shipped surface stays explicit so distribution drift is observable in the process-level contract

### Scenario: Go lint instructions remain conditional on a Go manifest

- [x] RED skip: this control behavior already passed before the fix; the JavaScript-only scenario supplied the regression failure
- [x] GREEN d07030c36
- [x] REFACTOR skip: the shared fixture is the only common structure; the control asserts distinct Go-manifest behavior

## Cross-scenario refactor

- [x] cross-scenario skip: the two cases share only the process fixture, and extracting more would obscure their distinct language-manifest assertions
