# Test Definitions: migrate consumers to test-plan

> **Retrospective ledger — not a per-step record.** These RED/GREEN/REFACTOR
> boxes were filled in after the fact: the file entered git history already
> ticked, with no per-step commit SHAs. Do not cite this ledger as precedent
> for R/G/R bookkeeping (issue #644 G8; per-step enforcement is G3 + G5).

Feature source: `features/migrate-consumers-to-test-plan.feature`

R/G/R ledger. Executable Given/When/Then live in the `.feature`; CLI `--format sh`
output + eval exit-code via runCli, structural de-dup via file-content assertions,
stop-hook behavior via the `runTests` tests.

## Rule: test-plan --format sh emits an eval-able plan

### Scenario: An available entry becomes a cd-scoped command

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: An unavailable entry becomes a visible skip line, not a command

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Evaluating the script runs the resolved suite

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Evaluating the script fails when a suite fails

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: An empty plan evals to a clean no-op

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A polyglot repo renders every language's command

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: The shell plan honors --kind build

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: the stop hook resolves its suite via test-plan (no per-language strings)

### Scenario: test-runner.ts holds no per-language command strings

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A JS project still runs its test script and the acceptance lane

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A project with no runnable suite skips without blocking

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: /verify obtains its commands from test-plan (no inline language bash)

### Scenario: verify section 2 evals test-plan for both test and build, with no inline language branches

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Feature-level cross-scenario refactor

- [x] cross-scenario — skip: helpers (renderShellPlan, safewordCliCommand, resolvePlanCommands) factored during GREEN; no cross-scenario duplication emerged
