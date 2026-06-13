# Test Definitions: Codex PreToolUse Deny Spike

## Rule: Codex adapter preserves safeword intake gating

### Scenario: codex-pretooluse-deny-spike.SM1.AC1.missing_intake_state_denies_test_definitions_creation

Given a feature ticket is missing one or more safeword intake prerequisites
When a supported Codex edit call attempts to create that ticket's `test-definitions.md`
Then the Codex adapter denies the call with the existing phase-gate reason

- [x] RED skip: uncommitted run proved the adapter was missing and the scenario failed before implementation
- [x] GREEN skip: uncommitted run passed with the Codex adapter delegating to the existing phase gate
- [x] REFACTOR skip: no scenario-specific refactor needed beyond the shared adapter/test fixture

### Scenario: codex-pretooluse-deny-spike.SM1.AC2.complete_intake_state_allows_test_definitions_creation

Given a feature ticket has scope, out_of_scope, done_when, dimensions, a resolving JTBD, and an Acceptance Criterion
When a supported Codex edit call attempts to create that ticket's `test-definitions.md`
Then the Codex adapter allows the call without a denial payload

- [x] RED skip: uncommitted run proved the adapter was missing and the scenario failed before implementation
- [x] GREEN skip: uncommitted run passed with the complete-intake fixture allowed
- [x] REFACTOR skip: no scenario-specific refactor needed beyond the shared adapter/test fixture

## Rule: Codex adapter reports fallback denial through stderr

### Scenario: codex-pretooluse-deny-spike.SM1.AC3.exit_code_two_reports_the_block_reason

Given the same missing-intake condition that produces a JSON denial
When the Codex adapter is run in exit-code fallback mode
Then it exits with code 2 and writes the blocking reason to stderr

- [x] RED skip: uncommitted run proved the adapter was missing and the scenario failed before implementation
- [x] GREEN skip: uncommitted run passed with stderr fallback returning exit code 2
- [x] REFACTOR skip: no scenario-specific refactor needed beyond the shared adapter/test fixture

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: shared fixture helpers already cover the scenario set; no further cross-scenario refactor warranted
