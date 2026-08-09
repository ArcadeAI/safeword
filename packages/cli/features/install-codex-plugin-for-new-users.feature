@surface.openai-codex @surface.safeword-cli
Feature: Install the Safeword Codex plugin for new users

  @codex-plugin-install.TBU1.R1
  Rule: codex-plugin-install.TBU1.R1 - New-user installation enrolls each developer automatically

    Scenario: Fresh Codex installation enrolls automatic profile installation
      Given an empty project has no Safeword workflow material
      When the builder installs Safeword for Codex
      Then Safeword reports that automatic Codex profile enrollment is installed

    Scenario: Upgrade enrolls automatic Codex plugin installation
      Given a Safeword project can be upgraded
      When the builder upgrades Safeword
      Then Safeword reports that automatic Codex profile enrollment is installed

    @rejection
    Scenario: Fresh Codex installation does not direct builders to the legacy migration command
      Given an empty project has no Safeword workflow material
      When the builder installs Safeword for Codex
      Then Safeword does not direct the builder to the legacy Codex migration command

  @codex-plugin-install.TBU1.R2
  Rule: codex-plugin-install.TBU1.R2 - Profile installation leaves the project untouched

    Scenario: Fresh Codex installation verifies the profile plugin without project configuration
      Given a project has no Codex configuration
      And the Safeword Codex plugin can be installed and is enabled
      When the builder installs the Safeword Codex plugin
      Then the active Codex profile has the enabled Safeword plugin
      And the project has no Safeword Codex hook configuration
      And the builder is told to restart Codex before reviewing the installed plugin

    Scenario: Repeating Codex installation remains profile-only
      Given a project has no Codex configuration
      And the Safeword Codex plugin can be installed and is enabled
      When the builder installs the Safeword Codex plugin twice
      Then the active Codex profile has the enabled Safeword plugin
      And the project has no Safeword Codex hook configuration

    @rejection
    Scenario: Failed profile installation leaves no project Codex configuration
      Given a project has no Codex configuration
      And the Safeword Codex plugin cannot be installed
      When the builder installs the Safeword Codex plugin
      Then the Codex plugin installation fails with a remediation message
      And the project still has no Safeword Codex hook configuration

  @codex-plugin-install.NTB1.R1
  Rule: codex-plugin-install.NTB1.R1 - Legacy cleanup is an explicit verified action

    Scenario: Verified legacy cleanup preserves custom hooks without reinstalling the plugin
      Given a Safeword project has legacy Codex hooks and a custom Codex hook
      And the Safeword plugin rejects a second installation
      When the builder explicitly cleans up legacy Codex hooks
      Then only Safeword legacy Codex hooks are removed
      And the custom Codex hook remains unchanged
      And the profile plugin is not installed again

    @rejection
    Scenario: Legacy cleanup without explicit confirmation is refused
      Given a Safeword project has legacy Codex hooks
      When the builder tries to migrate Codex without cleanup confirmation
      Then Safeword refuses to remove legacy Codex hooks

  @codex-plugin-install.NTB1.R2
  Rule: codex-plugin-install.NTB1.R2 - Existing migration scripts remain compatible

    Scenario: Legacy plugin migration command still installs and verifies the profile plugin
      Given a project has no Codex configuration
      And the Safeword Codex plugin can be installed and is enabled
      When the builder runs the legacy Codex plugin migration command
      Then the active Codex profile has the enabled Safeword plugin

    @rejection
    Scenario: Legacy migration keeps the project untouched when plugin installation fails
      Given a project has no Codex configuration
      And the Safeword Codex plugin cannot be installed
      When the builder runs the legacy Codex plugin migration command
      Then the Codex plugin installation fails with a remediation message
      And the project still has no Safeword Codex hook configuration
