# Test Definitions: BDD lane adoption semantics (lean slice)

Ledger written retroactively for the lean slice (see ticket work log
2026-07-03T19:35Z): the slice was built as a spike on user instruction, with
tests and implementation landing together in commit 05cdf1d. Scenarios below
map 1:1 to the e2e tests added in `packages/cli/tests/commands/codify.test.ts`.

## Rule: codify surfaces the host conventions doc without corrupting output

### Scenario: bdd-lane-adoption.TB1.AC1.conventions_pointer_prints_to_stderr_when_configured

Given a ticket with scenarios and `.safeword/config.json` setting `bdd.conventions` to `tests/CONVENTIONS.md`
When `safeword codify <ticket>` runs
Then stderr contains the conventions path and stdout remains a clean two-test skeleton

- [x] RED 05cdf1d
- [x] GREEN 05cdf1d
- [x] REFACTOR skip: single-commit spike; no refactor needed

### Scenario: bdd-lane-adoption.TB1.AC1.no_pointer_when_conventions_unset

Given a ticket with scenarios and no `bdd` block in `.safeword/config.json`
When `safeword codify <ticket>` runs
Then stderr contains no host-conventions pointer

- [x] RED 05cdf1d
- [x] GREEN 05cdf1d
- [x] REFACTOR skip: single-commit spike; no refactor needed

## Rule: installed prose defers instead of hardcoding lane mechanics

### Scenario: bdd-lane-adoption.TB1.AC2.prose_deferral_wording

Given the installed BDD prose templates (TDD.md, SCENARIOS.md, planning-guide.md)
When a repo configures `paths.features`/`paths.steps` or `bdd.conventions`
Then the prose directs the agent to the configured lane and conventions doc instead of prescribing `features/<slug>.feature` + `steps/` + run-and-expect-failure

- [x] RED skip: prose-only change — verified by review of the diff in 05cdf1d, not an executable test
- [x] GREEN 05cdf1d
- [x] REFACTOR skip: prose-only change
