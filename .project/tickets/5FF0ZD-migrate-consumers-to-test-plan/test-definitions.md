# Test Definitions: migrate consumers to test-plan

Feature source: `features/migrate-consumers-to-test-plan.feature`

R/G/R ledger. Executable Given/When/Then live in the `.feature`; CLI `--format sh`
output + eval exit-code via runCli, structural de-dup via file-content assertions,
stop-hook behavior via the `runTests` tests.

## Rule: test-plan --format sh emits an eval-able plan

### Scenario: An available entry becomes a cd-scoped command

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unavailable entry becomes a visible skip line, not a command

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Evaluating the script runs the resolved suite

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Evaluating the script fails when a suite fails

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An empty plan evals to a clean no-op

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A polyglot repo renders every language's command

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The shell plan honors --kind build

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: the stop hook resolves its suite via test-plan (no per-language strings)

### Scenario: test-runner.ts holds no per-language command strings

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A JS project still runs its test script and the acceptance lane

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A project with no runnable suite skips without blocking

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: /verify obtains its commands from test-plan (no inline language bash)

### Scenario: verify section 2 evals test-plan for both test and build, with no inline language branches

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
