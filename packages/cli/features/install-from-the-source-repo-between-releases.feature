@surface.safeword-cli @surface.claude-code
Feature: Install Safeword from its own source repo between releases

  The Safeword source repo runs an unreleased CLI, so no promoted Claude plugin
  can match its version. Inside that repo only, install accepts the older
  released plugin that Claude's marketplace checkout offers, instead of failing
  every install on an update that cannot advance. Every other project still
  requires the plugin to match the CLI.

  These scenarios drive the built `safeword` CLI against a fake `claude` host
  whose marketplace checkout offers released plugin 1.1.0.

  Scenario: A maintainer installs from the source repo with the released plugin
    Given the Safeword source repo with released Claude plugin "1.1.0" installed
    When Safeword is installed for Claude
    Then the install succeeds without an error
    And Safeword explains that Claude uses released plugin "1.1.0"
    And Safeword does not ask Claude to update the plugin
    And Claude status accepts the installed plugin version

  @rejection
  Scenario: A consumer project still requires the plugin to match the CLI
    Given a consumer project with released Claude plugin "1.1.0" installed
    When Safeword is installed for Claude
    Then the install fails with "CLAUDE_PLUGIN_UNVERIFIED"
    And Safeword asks Claude to update the plugin
    And Claude status reports the plugin as the wrong version

  @rejection
  Scenario: The source repo still refuses a plugin newer than the CLI
    Given the Safeword source repo with Claude plugin "99.0.0" installed
    When Safeword is installed for Claude
    Then the install fails with "CLAUDE_PLUGIN_DOWNGRADE_REFUSED"
    And Safeword does not ask Claude to update the plugin
