@surface.openai-codex @surface.safeword-cli
Feature: Update Safeword without restarting Codex

  @codex-plugin-next-task-upgrades.TBU1.R1
  Rule: codex-plugin-next-task-upgrades.TBU1.R1 — Installation refreshes an existing Git marketplace before selecting the released plugin

    Scenario: Fresh profile adds the marketplace before installing the plugin
      Given a Codex profile without the Safeword marketplace or plugin
      When the builder installs the Safeword Codex plugin
      Then the marketplace is added before the plugin install command selects the exact released Safeword version

    @rejection
    Scenario: Marketplace add failure prevents plugin installation
      Given a fresh Codex profile whose Safeword marketplace cannot be added
      When the builder installs the released Safeword Codex plugin
      Then installation fails before the plugin install command runs

    Scenario: Existing Git marketplace refreshes before installing the released plugin
      Given a Codex profile with an older Safeword plugin from the configured Git marketplace
      When the builder installs the released Safeword Codex plugin
      Then the existing marketplace is upgraded before the plugin install command selects the exact released Safeword version

    @rejection
    Scenario: Marketplace refresh failure prevents installation from stale metadata
      Given a Codex profile whose configured Safeword Git marketplace cannot refresh
      When the builder installs the released Safeword Codex plugin
      Then installation fails before the plugin install command runs

  @codex-plugin-next-task-upgrades.TBU1.R2
  Rule: codex-plugin-next-task-upgrades.TBU1.R2 — The current task keeps its loaded plugin while a new task activates the installed version without an application restart

    Scenario: Successful installation explains next-task activation without a restart
      Given a Codex task is running with an older Safeword plugin
      When the builder installs the released Safeword Codex plugin
      Then the result says the current task keeps its loaded version and a new task uses the installed version without restarting Codex

    @live @manual
    Scenario: Installing an upgrade does not change the running task
      Given a Codex task loaded an older version-pinned Safeword hook manifest
      When the builder installs the released Safeword Codex plugin
      Then the running task keeps the older version-pinned hook manifest

    @live @manual
    Scenario: A new task activates the installed release without restarting Codex
      Given the released Safeword Codex plugin is installed while another task keeps its loaded version
      When the builder starts a new Codex task
      Then the new task loads the exact released hook manifest without restarting Codex

    @rejection
    Scenario: Pending activation status never claims the current task hot-reloaded
      Given the released Safeword plugin is installed but no new Codex task has supplied proof
      When the builder checks the Codex plugin activation status
      Then status reports plugin_installed_new_session_required and directs the builder to start a new task and review hooks

  @codex-plugin-next-task-upgrades.TBU1.R3
  Rule: codex-plugin-next-task-upgrades.TBU1.R3 — Hook activation remains bound to the installed version and exact manifest until a new task supplies current proof

    Scenario: Matching SessionStart proof completes next-task activation
      Given a profile with next-task activation pending for the installed plugin identity
      When a new Codex task invokes the installed profile-plugin SessionStart dispatcher
      Then current proof replaces the pending marker and status no longer requires a new task

    @rejection
    Scenario Outline: Either plugin identity mismatch prevents activation completion
      Given activation is pending for <pending-version> version and <pending-manifest> hook manifest identity
      When a new Codex task invokes the installed profile-plugin SessionStart dispatcher
      Then proof for <proof-version> version and <proof-manifest> hook manifest does not clear the unmatched marker or claim its activation

      Examples:
        | pending-version | pending-manifest | proof-version | proof-manifest |
        | older           | current          | current       | current        |
        | current         | older            | current       | current        |

    Scenario: Later tasks preserve completed activation
      Given exact current plugin proof exists and no activation marker is pending
      When a later Codex task starts
      Then exact current proof remains valid and status does not reintroduce a next-task requirement

  @codex-plugin-next-task-upgrades.TBU1.R4
  Rule: codex-plugin-next-task-upgrades.TBU1.R4 — Profiles carrying the former restart marker converge to the next-task activation contract without losing proof state

    Scenario: Matching legacy marker is recognized and retired by the next task
      Given a profile with a valid v0.70 restart-pending marker for the installed plugin identity
      When a new Codex task invokes the installed profile-plugin SessionStart dispatcher
      Then the legacy marker is removed and current SessionStart proof is retained

    Scenario: Legacy-marker migration preserves existing exact proof
      Given current SessionStart proof for the installed plugin identity and a valid v0.70 restart-pending marker
      When a new Codex task invokes the installed profile-plugin SessionStart dispatcher
      Then proof still establishes the exact installed identity and the legacy marker is retired

    @rejection
    Scenario Outline: Invalid legacy markers do not manufacture pending activation
      Given a profile with a <marker-kind> v0.70 restart-pending marker
      When the builder checks the Codex plugin activation status
      Then status does not report next-task activation pending or synthesize current proof from that marker

      Examples:
        | marker-kind |
        | malformed   |
        | stale       |
