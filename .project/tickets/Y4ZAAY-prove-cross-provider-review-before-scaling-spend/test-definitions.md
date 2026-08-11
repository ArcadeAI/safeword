# Test Definitions: Prove cross-provider review before scaling spend

Feature source: `features/prove-cross-provider-review-before-scaling-spend.feature`

test-definitions.md is the R/G/R ledger.

## Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R1 — The recorded provider identity matches the provider that performed every paid turn

### Scenario: Complete retained Terra fixtures are accepted as route-valid

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Stubbed production wiring targets OpenAI for reading and verification

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Registered provenance is copied by repeatable fixtures

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Terra performs every provider turn over the legacy development corpus

RED is established by `Complete retained Terra fixtures are accepted as route-valid` and the registered-provenance fixture before the one authorized live canary exercises the same assertions.
The `@paid-canary` tag is excluded from default and CI runs. Its single authorized execution uses the same durable state and cannot be repeated after either guard blocks it.
Authorization is inapplicable to non-authorization fixtures because they cannot dispatch; live authorization scenarios exercise that guard explicitly.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Provider evidence cannot be relabeled as Terra

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Legacy corpus provenance cannot be replaced

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Provenance-invalid paid usage is never refunded

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R2 — Durable attempt and cost evidence bounds every new paid attempt

### Scenario: An infrastructure retry consumes another review attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A retryable OpenAI transport failure is never retried invisibly

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: One multi-turn review counts as one attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Explicit initialization bootstraps empty durable accounting

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: An uninitialized canary cannot execute

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Deleted ledgers cannot reset an initialized canary

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Untrusted initialization state cannot authorize planted ledgers

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Explicit re-initialization cannot reset an initialized canary

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Initialization fails closed when trusted upstream state cannot be read

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Durable attempt count bounds same-process and resumed execution

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unfinished paid attempt still consumes the cap after resume

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A provider request without prior durable attempt intent blocks resume

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A present intent must precede and uniquely authorize each request

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A route-invalid paid attempt still consumes the cap

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Route-invalid usage never receives an invented price

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Untrustworthy attempt-count evidence blocks resume

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Simultaneously incomplete accounting reports both reasons

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Partial initialized state fails closed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Durable spend state bounds same-process and resumed execution

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Both durable limits are reported when both have been reached

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Incomplete cost evidence blocks the next attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A reached attempt stop is reported alongside incomplete cost accounting

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A reached cost stop is reported alongside incomplete attempt accounting

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A completed threshold-reaching attempt retains correctly priced evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Context pricing switches only above 272000 input tokens

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Detailed usage components use the frozen standard rates

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: An absent OpenAI cache-write usage field normalizes to zero

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Mixed detailed usage produces one observable total cost

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A multi-turn attempt sums every turn cost exactly once

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Crossing the cost threshold during a turn does not truncate the started attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Live execution without explicit authorization makes no paid request

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Default selectors cannot execute the paid canary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Authorization cannot be replayed or weakened

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Missing authorization is reported with every simultaneous accounting outcome

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R3 — Development evidence remains permanently separate from confirmatory evidence

### Scenario Outline: Independently anchored confirmatory evidence remains usable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A produced canary artifact is durably diagnostic-only

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A successful development canary cannot become confirmation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Trusted registration lookup failures deny confirmation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
