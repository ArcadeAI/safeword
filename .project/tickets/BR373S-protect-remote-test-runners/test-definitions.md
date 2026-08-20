# Test Definitions: Run the requested revision remotely with least privilege

Feature source: `packages/cli/features/run-requested-revision-remotely.feature`

This file is the RED/GREEN/REFACTOR ledger.

## Rule: remote-runner.TBU1.R1 — The remote job tests and reports the exact requested commit

### Scenario Outline: The requested commit is reported for a passing or failing test

- [x] RED 4f2c0656e
- [x] GREEN de51cadc7
- [x] REFACTOR 85c32e375

### Scenario Outline: An invalid commit value starts no repository test

- [x] RED 8b46efc07
- [x] GREEN 5f7df0aae
- [x] REFACTOR skip: the invalid-value table shares one real validation and reporting path without duplication

### Scenario: An unavailable requested commit is never replaced by another revision

- [x] RED 9be579aa5
- [x] GREEN 4a32f7884
- [x] REFACTOR skip: the unavailable checkout path already reuses the workflow's validation and reporting scripts directly

### Scenario: A checkout that lands on another commit is rejected before tests

- [x] RED 885075cfc
- [x] GREEN c44d1f079
- [x] REFACTOR e6780bd37

### Scenario: Cancellation is not reported as a request rejection or test conclusion

- [x] RED 885075cfc
- [x] GREEN b7555495f
- [x] REFACTOR e6780bd37

## Rule: remote-runner.TBU1.R2 — The remote job runs only the requested supported test lane

### Scenario Outline: A supported lane runs its matching Safeword test plan

- [x] RED 517c3f3d6
- [x] GREEN 58e0e34e6
- [x] REFACTOR skip: the green change already extracted one focused test-command recorder and left no second abstraction to justify

### Scenario Outline: An unsupported lane starts no repository test

- [x] RED 511fdb58a
- [x] GREEN 95d872710
- [x] REFACTOR skip: invalid revisions and unsupported lanes now share one real rejected-input execution path

## Rule: remote-runner.TBU1.R3 — Repository code receives only the admitted read-only authority and immutable workflow dependencies

### Scenario: The bundled workflow is accepted under the minimum runner contract

- [x] RED 9a0a300be
- [x] GREEN 9cc75716c
- [x] REFACTOR skip: the evaluator is already split only along the four contract boundaries it enforces

### Scenario Outline: A workflow outside the minimum authority contract is rejected

- [x] RED 49c40316d
- [x] GREEN 2fdacafa5
- [x] REFACTOR skip: all seven mutations exercise the same evaluator without scenario-specific policy branches

## Cross-scenario refactor

- [x] cross-scenario e6780bd37
