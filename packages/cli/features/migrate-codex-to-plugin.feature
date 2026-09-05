@surface.openai-codex
Feature: Move Codex users to the Safeword plugin

  @migrate-codex-to-plugin.TB1.R1
  Rule: migrate-codex-to-plugin.TB1.R1 - Standard setup and upgrade enroll profiles without removing ambiguous legacy hooks

    Scenario: Upgrade retains legacy hooks until explicit migration
      Given a Safeword project has legacy Codex hooks
      When the builder upgrades Safeword
      Then the legacy Codex hooks remain and the enrollment bootstrap is added

    @rejection
    Scenario: Fresh setup creates only the non-blocking enrollment bootstrap
      Given a project has no Codex configuration
      When the builder sets up Safeword
      Then the project has only the Safeword Codex enrollment bootstrap

  @surface.safeword-cli @migrate-codex-to-plugin.TB1.R2
  Rule: migrate-codex-to-plugin.TB1.R2 - Explicit migration verifies the profile plugin and preserves Safeword-owned project hooks until the reviewed handoff cleanup

    Scenario: Verified plugin migration preserves legacy hooks pending review
      Given a Safeword project has legacy Codex hooks
      And the Safeword Codex plugin can be installed and is enabled
      When the builder migrates Codex to the plugin
      Then the active Codex profile has the enabled Safeword plugin
      And the legacy Codex hooks remain unchanged
      And the builder is told to review the Safeword hooks in Codex before cleanup

    @rejection
    Scenario: Codex migration failure retains legacy hooks
      Given a Safeword project has legacy Codex hooks
      And the Safeword Codex plugin cannot be installed
      When the builder migrates Codex to the plugin
      Then the migration fails with a remediation message
      And the legacy Codex hooks remain unchanged

    @rejection
    Scenario: Disabled plugin retains legacy hooks
      Given a Safeword project has legacy Codex hooks
      And Codex reports the Safeword plugin is disabled
      When the builder migrates Codex to the plugin
      Then the migration fails with a remediation message
      And the legacy Codex hooks remain unchanged

    @rejection
    Scenario: Missing Bun retains legacy hooks
      Given a Safeword project has legacy Codex hooks
      And Bun is unavailable
      When the builder migrates Codex to the plugin
      Then the migration fails with a remediation message
      And the legacy Codex hooks remain unchanged

  @migrate-codex-to-plugin.TB1.R3
  Rule: migrate-codex-to-plugin.TB1.R3 - Migration preserves user-authored Codex configuration and hooks

    Scenario: Mixed Codex configuration retains custom hooks
      Given a Safeword project has legacy Codex hooks and a custom Codex hook
      And the Safeword Codex plugin can be installed and is enabled
      When the builder migrates Codex to the plugin
      Then the custom Codex hook remains unchanged
      And the legacy Codex hooks remain unchanged

    @rejection
    Scenario: Configuration without Safeword hooks remains unchanged
      Given a Safeword project has a custom Codex hook but no legacy Codex hooks
      And the Safeword Codex plugin can be installed and is enabled
      When the builder migrates Codex to the plugin
      Then the custom Codex hook remains unchanged

  @migrate-codex-to-plugin.SM1.R1
  Rule: migrate-codex-to-plugin.SM1.R1 - The shipped plugin uses its bundled CLI and no runtime package installation

    @rejection
    Scenario: Plugin release contract rejects runtime package installation
      Given a plugin hook command installs a package at runtime
      When the release contract runs
      Then the release contract fails

  @migrate-codex-to-plugin.SM1.R2
  Rule: migrate-codex-to-plugin.SM1.R2 - The packed package and a real isolated Codex profile prove the release contract

    Scenario: Packed plugin preserves the bundled-runtime dispatch contract
      Given the Safeword package is packed
      When the packed plugin release contract runs
      Then the packed plugin dispatches the bundled CLI directly

    @rejection
    Scenario: Release rejects a package missing plugin assets
      Given the Safeword package is packed without a required plugin asset
      When the release contract runs
      Then the release contract fails
