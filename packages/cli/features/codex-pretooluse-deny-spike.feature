@codex-pretooluse-deny-spike
Feature: Codex PreToolUse deny spike

  The Codex PreToolUse adapter reuses safeword's existing phase gate for
  supported edit calls and preserves both documented denial signaling paths.

  Rule: Codex adapter preserves safeword intake gating

    @codex-pretooluse-deny-spike.SM1.AC1
    Scenario: codex-pretooluse-deny-spike.SM1.AC1.missing_intake_state_denies_test_definitions_creation
      Given a feature ticket is missing one or more safeword intake prerequisites
      When a supported Codex edit call attempts to create that ticket's `test-definitions.md`
      Then the Codex adapter denies the call with the existing phase-gate reason

    @codex-pretooluse-deny-spike.SM1.AC1
    Scenario: codex-pretooluse-deny-spike.SM1.AC1.multi_file_patch_denies_if_any_target_is_blocked
      Given a feature ticket is missing one or more safeword intake prerequisites
      When a supported Codex multi-file edit call attempts to create another file and that ticket's `test-definitions.md`
      Then the Codex adapter denies the call with the existing phase-gate reason

    @codex-pretooluse-deny-spike.SM1.AC2
    Scenario: codex-pretooluse-deny-spike.SM1.AC2.complete_intake_state_allows_test_definitions_creation
      Given a feature ticket has scope, out_of_scope, done_when, dimensions, a resolving JTBD, and an Acceptance Criterion
      When a supported Codex edit call attempts to create that ticket's `test-definitions.md`
      Then the Codex adapter allows the call without a denial payload

  Rule: Codex adapter reports fallback denial through stderr

    @codex-pretooluse-deny-spike.SM1.AC3
    Scenario: codex-pretooluse-deny-spike.SM1.AC3.exit_code_two_reports_the_block_reason
      Given the same missing-intake condition that produces a JSON denial
      When the Codex adapter is run in exit-code fallback mode
      Then it exits with code 2 and writes the blocking reason to stderr
