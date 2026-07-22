@surface.openai-codex
Feature: Move Codex users to the Safe Word plugin

  @migrate-codex-to-plugin.TB1.R1
  Rule: migrate-codex-to-plugin.TB1.R1 - Standard setup and upgrade never change a user's Codex profile or remove existing legacy hooks

    Scenario: Upgrade retains legacy hooks until explicit migration
      Given a Safe Word project has legacy Codex hooks
      When the builder upgrades Safe Word
      Then the legacy Codex hooks remain unchanged

    @rejection
    Scenario: Fresh setup does not create Safe Word Codex hooks
      Given a project has no Codex configuration
      When the builder sets up Safe Word
      Then the project has no Safe Word Codex hook configuration

  @surface.safeword-cli @migrate-codex-to-plugin.TB1.R2
  Rule: migrate-codex-to-plugin.TB1.R2 - Explicit migration verifies the profile plugin and preserves Safe Word-owned project hooks until the reviewed handoff cleanup

    Scenario: Verified plugin migration preserves legacy hooks pending review
      Given a Safe Word project has legacy Codex hooks
      And the Safe Word Codex plugin can be installed and is enabled
      When the builder migrates Codex to the plugin
      Then the active Codex profile has the enabled Safe Word plugin
      And the legacy Codex hooks remain unchanged
      And the builder is told to review the Safe Word hooks in Codex before cleanup

    @rejection
    Scenario: Failed plugin installation retains legacy hooks
      Given a Safe Word project has legacy Codex hooks
      And the Safe Word Codex plugin cannot be installed
      When the builder migrates Codex to the plugin
      Then the migration fails with a remediation message
      And the legacy Codex hooks remain unchanged

    @rejection
    Scenario: Disabled plugin retains legacy hooks
      Given a Safe Word project has legacy Codex hooks
      And Codex reports the Safe Word plugin is disabled
      When the builder migrates Codex to the plugin
      Then the migration fails with a remediation message
      And the legacy Codex hooks remain unchanged

    @rejection
    Scenario: Missing Bun retains legacy hooks
      Given a Safe Word project has legacy Codex hooks
      And Bun is unavailable
      When the builder migrates Codex to the plugin
      Then the migration fails with a remediation message
      And the legacy Codex hooks remain unchanged

  @migrate-codex-to-plugin.TB1.R3
  Rule: migrate-codex-to-plugin.TB1.R3 - Migration preserves user-authored Codex configuration and hooks

    Scenario: Mixed Codex configuration retains custom hooks
      Given a Safe Word project has legacy Codex hooks and a custom Codex hook
      And the Safe Word Codex plugin can be installed and is enabled
      When the builder migrates Codex to the plugin
      Then the custom Codex hook remains unchanged
      And the legacy Codex hooks remain unchanged

    @rejection
    Scenario: Configuration without Safe Word hooks remains unchanged
      Given a Safe Word project has a custom Codex hook but no legacy Codex hooks
      And the Safe Word Codex plugin can be installed and is enabled
      When the builder migrates Codex to the plugin
      Then the custom Codex hook remains unchanged

  @migrate-codex-to-plugin.SM1.R1
  Rule: migrate-codex-to-plugin.SM1.R1 - The shipped plugin uses exact version-pinned Bunx commands and no Codex npx command

    @rejection
    Scenario: Plugin release contract rejects an unpinned or npx command
      Given a plugin hook command is unpinned or uses npx
      When the release contract runs
      Then the release contract fails

  @migrate-codex-to-plugin.SM1.R2
  Rule: migrate-codex-to-plugin.SM1.R2 - The packed package and a real isolated Codex profile prove the release contract

    Scenario: Packed plugin preserves the Bunx dispatch contract
      Given the Safe Word package is packed
      When the packed plugin release contract runs
      Then the packed plugin dispatches the packaged CLI through Bunx

    @rejection
    Scenario: Release rejects a package missing plugin assets
      Given the Safe Word package is packed without a required plugin asset
      When the release contract runs
      Then the release contract fails
