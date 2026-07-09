@auto-upgrade-codex
Feature: Auto-upgrade under Codex

  Codex users get safeword's patch/minor auto-upgrade without adding a second
  concurrent SessionStart hook or relying on Claude-specific rewake semantics.

  Rule: Codex SessionStart uses one dispatcher

    @auto-upgrade-codex.TB1.AC1
    Scenario: auto-upgrade-codex.TB1.AC1.fresh_setup_wires_one_codex_sessionstart_dispatcher
      Given a fresh project runs safeword setup
      When the generated Codex config is inspected
      Then exactly one safeword SessionStart command is wired
      And the command runs `safeword codex-hook session-start`
      And the command does not run `session-safeword-context.ts` directly

    @auto-upgrade-codex.TB1.AC2
    Scenario: auto-upgrade-codex.TB1.AC2.codex_dispatcher_emits_safeword_context_after_upgrade_check
      Given a safeword-managed project has SAFEWORD.md standing instructions
      When the Codex SessionStart dispatcher runs with no upgrade to apply
      Then it exits successfully
      And it emits Codex SessionStart additionalContext containing SAFEWORD.md

  Rule: Auto-upgrade core maps outcomes per agent

    @auto-upgrade-codex.SM1.AC1
    Scenario: auto-upgrade-codex.SM1.AC1.claude_wrapper_preserves_async_rewake_notices
      Given a major safeword version is available
      When the Claude auto-upgrade wrapper handles the shared core outcome
      Then it writes the manual-upgrade notice to stderr
      And it exits with code 2

    @auto-upgrade-codex.TB1.AC3
    Scenario: auto-upgrade-codex.TB1.AC3.codex_dispatcher_never_uses_exit_two_for_notices
      Given a major safeword version is available
      When the Codex SessionStart dispatcher handles the shared core outcome
      Then it exits successfully
      And the notice is included in Codex SessionStart output

  Rule: Failed apply rolls back safeword-managed changes

    @auto-upgrade-codex.SM1.AC2
    Scenario: auto-upgrade-codex.SM1.AC2.failed_apply_rolls_back_safeword_managed_files
      Given a clean git project has safeword-managed files
      And the upgrade command changes tracked and untracked safeword-managed files before failing
      When the shared auto-upgrade core records the failed attempt
      Then safeword-managed changes from the failed upgrade are rolled back
      And the failure strike is recorded for the target version
