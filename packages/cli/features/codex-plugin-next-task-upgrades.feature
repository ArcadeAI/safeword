@surface.openai-codex @surface.safeword-cli
Feature: Activate Safeword upgrades coherently in Codex

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
  Rule: codex-plugin-next-task-upgrades.TBU1.R2 — Installation status requires a full Codex restart and lets the builder resume the same task

    Scenario: Successful installation explains the required app restart
      Given a Codex task is running with an older Safeword plugin
      When the builder installs the released Safeword Codex plugin
      Then the result says the Codex app may keep its loaded catalogue and must fully restart before this task verifies the installed version

    @live @manual
    Scenario: Installing an upgrade does not change the running task
      Given a Codex task loaded an older version-pinned Safeword hook manifest
      When the builder installs the released Safeword Codex plugin
      Then the running task keeps the older version-pinned hook manifest

    @live @manual
    Scenario: Resuming a task in the same app does not prove coherent activation
      Given the released Safeword Codex plugin is installed while another task keeps its loaded version
      When the builder resumes the task without fully restarting Codex
      Then the resumed task may still expose an older skill catalogue and activation remains pending

    @live @manual
    Scenario: A restarted app activates the installed release in a resumed task
      Given the released Safeword Codex plugin is installed while another task keeps its loaded version
      When the builder fully restarts Codex and resumes the existing task
      Then the resumed task loads the exact released skill catalogue and hook manifest

    @rejection
    Scenario: Pending activation status never claims the running app reloaded
      Given the released Safeword plugin is installed but Codex has not restarted
      When the builder checks the Codex plugin activation status
      Then status reports plugin_installed_app_restart_required and directs the builder to review hooks before restarting

  @codex-plugin-next-task-upgrades.TBU1.R3
  Rule: codex-plugin-next-task-upgrades.TBU1.R3 — Activation proof belongs to the exact installed release, resumed task, profile, canonical worktree, and restarted Codex app

    @rejection
    Scenario: Matching SessionStart from the installing app does not complete activation
      Given a profile with app-restart activation pending for the installed plugin identity
      When the resumed task in the same Codex app invokes the installed profile-plugin SessionStart dispatcher
      Then same-host proof does not replace the pending marker or satisfy the restart requirement

    Scenario: Matching SessionStart from a restarted app completes activation
      Given a profile with app-restart activation pending for the installed plugin identity
      When a restarted Codex app resumes the task through the installed profile-plugin SessionStart dispatcher
      Then restart-bound proof replaces the pending marker and status no longer requires an app restart

    @rejection
    Scenario Outline: Either plugin identity mismatch prevents activation completion
      Given activation is pending for <pending-version> version and <pending-manifest> hook manifest identity
      When a restarted Codex app invokes the installed profile-plugin SessionStart dispatcher
      Then proof for <proof-version> version and <proof-manifest> hook manifest does not clear the unmatched marker or claim its activation

      Examples:
        | pending-version | pending-manifest | proof-version | proof-manifest |
        | older           | current          | current       | current        |
        | current         | older            | current       | current        |

    Scenario: Later tasks preserve completed activation
      Given exact current plugin proof exists and no activation marker is pending
      When a later Codex task starts
      Then exact current proof remains valid and status does not reintroduce an app-restart requirement

  @codex-plugin-next-task-upgrades.TBU1.R4
  Rule: codex-plugin-next-task-upgrades.TBU1.R4 — Invalid legacy markers never manufacture activation proof

    @rejection
    Scenario Outline: Invalid legacy markers do not manufacture pending activation
      Given a profile with a <marker-kind> v0.70 restart-pending marker
      When the builder checks the Codex plugin activation status
      Then status does not report app-restart activation pending or synthesize current proof from that marker

      Examples:
        | marker-kind |
        | malformed   |
        | stale       |
