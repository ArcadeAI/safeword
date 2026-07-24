@surface.openai-codex @surface.safeword-cli
Feature: Install the Safe Word Codex plugin for new users

  @codex-plugin-install.TBU1.R1
  Rule: codex-plugin-install.TBU1.R1 - New-user guidance names installation rather than migration

    Scenario: Fresh setup directs the builder to install the Codex plugin
      Given an empty project has no Safe Word workflow material
      When the builder sets up Safe Word for Codex
      Then Safe Word directs the builder to the Codex plugin install command

    Scenario: Upgrade directs the builder to install the Codex plugin
      Given a Safe Word project can be upgraded
      When the builder upgrades Safe Word
      Then Safe Word directs the builder to the Codex plugin install command

    @rejection
    Scenario: Fresh setup does not direct builders to the legacy migration command
      Given an empty project has no Safe Word workflow material
      When the builder sets up Safe Word for Codex
      Then Safe Word does not direct the builder to the legacy Codex migration command

  @codex-plugin-install.TBU1.R2
  Rule: codex-plugin-install.TBU1.R2 - Profile installation leaves the project untouched

    Scenario: Fresh Codex installation verifies the profile plugin without project configuration
      Given a project has no Codex configuration
      And the Safe Word Codex plugin can be installed and is enabled
      When the builder installs the Safe Word Codex plugin
      Then the active Codex profile has the enabled Safe Word plugin
      And the project has no Safe Word Codex hook configuration
      And the builder is told to start a new Codex session

    Scenario: Repeating Codex installation remains profile-only
      Given a project has no Codex configuration
      And the Safe Word Codex plugin can be installed and is enabled
      When the builder installs the Safe Word Codex plugin twice
      Then the active Codex profile has the enabled Safe Word plugin
      And the project has no Safe Word Codex hook configuration

    @rejection
    Scenario: Failed profile installation leaves no project Codex configuration
      Given a project has no Codex configuration
      And the Safe Word Codex plugin cannot be installed
      When the builder installs the Safe Word Codex plugin
      Then the Codex plugin installation fails with a remediation message
      And the project still has no Safe Word Codex hook configuration

  @codex-plugin-install.NTB1.R1
  Rule: codex-plugin-install.NTB1.R1 - Legacy cleanup is an explicit verified action

    Scenario: Verified legacy cleanup preserves custom hooks without reinstalling the plugin
      Given a Safe Word project has legacy Codex hooks and a custom Codex hook
      And the Safe Word plugin rejects a second installation
      When the builder explicitly cleans up legacy Codex hooks
      Then only Safe Word legacy Codex hooks are removed
      And the custom Codex hook remains unchanged
      And the profile plugin is not installed again

    @rejection
    Scenario: Legacy cleanup without explicit confirmation is refused
      Given a Safe Word project has legacy Codex hooks
      When the builder tries to migrate Codex without cleanup confirmation
      Then Safe Word refuses to remove legacy Codex hooks

  @codex-plugin-install.NTB1.R2
  Rule: codex-plugin-install.NTB1.R2 - Existing migration scripts remain compatible

    Scenario: Legacy plugin migration command still installs and verifies the profile plugin
      Given a project has no Codex configuration
      And the Safe Word Codex plugin can be installed and is enabled
      When the builder runs the legacy Codex plugin migration command
      Then the active Codex profile has the enabled Safe Word plugin

    @rejection
    Scenario: Legacy migration keeps the project untouched when plugin installation fails
      Given a project has no Codex configuration
      And the Safe Word Codex plugin cannot be installed
      When the builder runs the legacy Codex plugin migration command
      Then the Codex plugin installation fails with a remediation message
      And the project still has no Safe Word Codex hook configuration
