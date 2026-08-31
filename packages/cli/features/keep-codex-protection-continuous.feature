@surface.openai-codex @surface.safeword-cli
Feature: Keep Codex protection continuous during profile-plugin migration

  @codex-continuity.TBU1.R1 @rejection
  Rule: codex-continuity.TBU1.R1 — Generic project maintenance never retires working legacy Codex protection

    Scenario: Upgrade preserves recognized legacy protection
      Given a configured project with recognized legacy Codex hooks and workflow assets
      When the builder upgrades Safeword
      Then the legacy Codex assets remain protected and automatic enrollment is added

    Scenario: Plugin installation failure leaves repository protection unchanged
      Given a configured project with recognized legacy Codex protection
      And the active Codex profile cannot install the Safeword plugin
      When the builder migrates Codex
      Then migration fails without changing the repository

    Scenario: Partial profile installation failure leaves repository protection unchanged
      Given a configured project with recognized legacy Codex protection
      And plugin installation succeeds before a later Codex verification command fails
      When the builder migrates Codex
      Then migration reports installation succeeded, enablement is unknown, and the repository is unchanged

  @codex-continuity.TBU1.R2
  Rule: codex-continuity.TBU1.R2 — Plugin readiness requires current hook-execution proof, not installation or enablement alone

    @rejection
    Scenario: Enabled plugin without proof remains unproven
      Given the active Codex profile reports the Safeword plugin enabled
      And no current profile hook proof exists
      When the builder checks Codex status
      Then status reports plugin_enabled_hook_unproven and recommends hook review in the restarted app
      And the public JSON envelope contains only the unproven migration status

    @rejection
    Scenario: Enabled older plugin requires an update
      Given the active Codex profile reports an enabled older Safeword plugin
      When the builder checks Codex status
      Then status reports plugin_update_required and recommends updating the plugin

    Scenario: Successful installation requires an app restart
      Given the active Codex profile does not contain the Safeword plugin
      When the builder migrates Codex and installation succeeds
      Then migration reports plugin_installed_app_restart_required and changes no repository file
      And the profile contains an activation marker bound to the installed version and hook manifest

    @rejection
    Scenario: Plugin SessionStart from the installing app does not clear activation state
      Given a profile with a current activation-pending marker
      When Codex invokes the marked profile-plugin SessionStart dispatcher
      Then same-host proof preserves the activation marker and status still requires an app restart

    Scenario: Plugin SessionStart from a restarted app completes activation
      Given a profile with app-restart activation pending for the installed plugin identity
      When a restarted Codex app invokes the installed profile-plugin SessionStart dispatcher
      Then restart-bound proof replaces the pending marker and status no longer requires an app restart

    Scenario: Installing while Codex is closed activates on the next app start
      Given a profile installed while no Codex host was running
      When the next Codex app invokes the installed profile-plugin SessionStart dispatcher
      Then restart-bound proof replaces the pending marker and status no longer requires an app restart

    Scenario: Trusted plugin SessionStart records event-specific proof
      Given the Safeword profile-plugin SessionStart dispatcher is trusted
      When Codex invokes it with the plugin-hook marker
      Then the profile contains schema 2 proof with the running version, exact manifest digest, and a parseable UTC timestamp

    @rejection
    Scenario: Interrupted proof write cannot become current
      Given the Safeword profile-plugin SessionStart proof write is interrupted
      When the builder checks Codex status
      Then no partial or malformed proof is accepted as current
      And status reports plugin_enabled_hook_unproven

    @rejection
    Scenario Outline: Changed plugin identity invalidates proof
      Given profile hook proof differs from the running plugin by <difference>
      When the builder checks Codex status
      Then status reports plugin_enabled_hook_unproven

      Examples:
        | difference           |
        | package version      |
        | hook manifest digest |
        | proof schema         |
        | malformed JSON       |
        | missing fields       |

    @rejection
    Scenario: Legacy SessionStart cannot create plugin proof
      Given a project-local legacy SessionStart dispatcher
      When Codex invokes it without the plugin-hook marker
      Then no profile hook proof is written

  @codex-continuity.TBU1.R3
  Rule: codex-continuity.TBU1.R3 — Coexistence executes exactly one authoritative implementation

    Scenario: Legacy handler remains authoritative for a covered event
      Given current plugin proof and configured project and profile handlers for PostToolUse
      When Codex dispatches PostToolUse through both handlers
      Then the legacy PostToolUse behavior executes exactly once and the packaged plugin behavior does not execute
      And the profile plugin records PostToolUse proof while legacy remains authoritative

    @rejection
    Scenario: Plugin covers an event missing from a partial legacy installation
      Given current plugin proof and legacy protection without a PostToolUse handler
      When the profile-plugin PostToolUse dispatcher runs
      Then the packaged PostToolUse behavior executes

    @rejection
    Scenario Outline: Plugin covers a configured legacy event with a broken runtime
      Given current plugin proof and a recognized legacy PostToolUse handler whose runtime is <runtime_state>
      When the profile-plugin PostToolUse dispatcher runs
      Then the packaged PostToolUse behavior executes

      Examples:
        | runtime_state              |
        | missing                    |
        | a symbolic link            |
        | backed by an unavailable package runner |

  @codex-continuity.TBU1.R4
  Rule: codex-continuity.TBU1.R4 — Shared cleanup is explicit, selective, recoverable, and idempotent

    @rejection
    Scenario: Finalization refuses stale proof without mutation
      Given legacy Codex assets and stale profile hook proof
      When the builder requests finalization
      Then finalization is rejected and every repository file remains unchanged

    @rejection
    Scenario: Unconfirmed finalization leaves the repository unchanged
      Given legacy Codex assets and current profile hook proof
      When the builder leaves the displayed finalization plan unconfirmed
      Then the command exits without changing the repository

    Scenario: Confirmed finalization creates a recoverable plugin-only project
      Given legacy Codex assets, custom Codex content, and current profile hook proof
      When the builder confirms the displayed finalization plan
      Then known legacy assets are backed up and removed while custom content remains
      And the repository records plugin mode and provides the setup bootstrap

    @rejection
    Scenario: Failed finalization rolls back to the complete pre-migration state
      Given a confirmed finalization whose repository mutation fails
      When Safeword handles the failure
      Then every prepared change is rolled back to the exact pre-migration state
      And the command reports failure without reporting recovery_required

    @rejection
    Scenario: Failed rollback retains recovery evidence
      Given a confirmed finalization whose repository mutation and restoration both fail
      When Safeword handles the failure
      Then the backup remains and the finalized marker is absent
      And status reports recovery_required

    Scenario: Repeated finalization of a plugin-only project is a no-op
      Given a finalized plugin-only project with current profile hook proof
      When the builder finalizes migration again
      Then the command succeeds without changing repository files

    Scenario Outline: Repeated migration converges in every pre-finalization state
      Given the repository and active profile derive the <state> state
      When the builder migrates Codex twice
      Then the second run reports <expected_state> without changing repository or profile state

      Examples:
        | state                         | expected_state                  |
        | legacy                        | plugin_installed_app_restart_required |
        | plugin_disabled               | plugin_installed_app_restart_required |
        | plugin_setup_required         | plugin_installed_app_restart_required |
        | plugin_update_required        | plugin_installed_app_restart_required |
        | plugin_installed_app_restart_required | plugin_installed_app_restart_required |
        | plugin_enabled_hook_unproven  | plugin_enabled_hook_unproven    |
        | compatibility                 | compatibility                  |
        | not_configured                | plugin_installed_app_restart_required |

    @rejection
    Scenario: Migration remains blocked while recovery is required
      Given a repository with an unresolved Codex migration backup
      When the builder migrates Codex twice
      Then both runs report recovery_required and change no repository file

    Scenario: Recovery restores the backed-up legacy state
      Given a repository with an unresolved Codex migration backup
      When the builder runs Codex recovery
      Then the pre-finalization files are restored and plugin-only markers are removed
      And the backup is resolved and subsequent status no longer reports recovery_required

    @rejection
    Scenario: Recovery refuses to overwrite an intervening edit
      Given a repository backup whose finalized output was edited afterward
      When the builder runs Codex recovery
      Then recovery reports the conflicting path and overwrites no repository file

    @rejection
    Scenario Outline: Handled transaction failure restores the pre-migration state
      Given confirmed finalization fails <boundary> while rollback remains available
      When Safeword handles the failure
      Then the exact pre-migration repository state is restored and the temporary backup is removed

      Examples:
        | boundary                      |
        | after backup creation         |
        | after config replacement      |
        | after legacy file removal     |
        | before finalized marker write |

    @rejection
    Scenario Outline: Process crash leaves deterministic recovery evidence
      Given the finalization process crashes <boundary>
      When the builder checks Codex status
      Then the contained backup remains, the finalized marker is absent, and status reports recovery_required

      Examples:
        | boundary                      |
        | after backup creation         |
        | after config replacement      |
        | after legacy file removal     |
        | before finalized marker write |

    @rejection
    Scenario Outline: Unsafe backup targets are rejected before mutation
      Given finalization would back up <unsafe_target>
      When the builder requests finalization
      Then finalization is rejected before any repository mutation

      Examples:
        | unsafe_target                  |
        | a path outside the repository  |
        | a symbolic-link file target    |

    Scenario: Deprecated cleanup alias follows the finalization contract
      Given legacy Codex assets, custom Codex content, and current profile hook proof
      When the builder uses the deprecated remove-legacy-hooks alias with confirmation
      Then known legacy assets are backed up and removed while custom content remains
      And the repository records plugin mode and provides the setup bootstrap

    Scenario: Explicit non-interactive finalization replays the confirmed plan
      Given legacy Codex assets and current profile hook proof in a non-interactive shell
      When an agent replays the previewed Codex finalization plan with finalize and yes flags
      Then known legacy assets are backed up and removed and status reports plugin

  @codex-continuity.NTB1.R1
  Rule: codex-continuity.NTB1.R1 — Every migration state names protection and one next action

    Scenario Outline: Human status gives one safe next action for settled migration states
      Given the repository and active profile derive the <fixture> fixture
      When Safeword derives human Codex status from the fixture
      Then status reports <state>, names protection as <protection>, and ends with <next_action>

      Examples:
        | fixture                    | state             | protection | next_action                       |
        | complete legacy           | legacy            | protected  | safeword codex migrate            |
        | partial legacy            | legacy            | partial    | safeword codex migrate            |
        | disabled plugin without legacy | plugin_disabled   | unprotected | safeword codex migrate           |
        | disabled plugin with complete legacy | plugin_disabled | protected | safeword codex migrate         |
        | disabled plugin with partial legacy | plugin_disabled | partial | safeword codex migrate             |
        | outdated plugin without legacy | plugin_update_required | unprotected | safeword codex migrate          |
        | restart pending without legacy | plugin_installed_app_restart_required | unprotected | Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task. |
        | restart completed without hook activation | plugin_installed_hook_activation_failed | unprotected | Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). If they are enabled and trusted, use a Codex surface that dispatches lifecycle hooks before relying on Safeword protection. |
        | restart completed with partial hook activation | plugin_enabled_hook_unproven | unprotected | Continue in this Codex session. Safeword will confirm protection after the remaining lifecycle hooks run. |
        | restart pending with complete legacy | plugin_installed_app_restart_required | protected | Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task. |
        | restart pending with partial legacy | plugin_installed_app_restart_required | partial | Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task. |
        | current proof and legacy  | compatibility     | protected  | safeword codex migrate --finalize |
        | no configuration          | not_configured    | unprotected | safeword codex migrate           |
        | finalized without plugin  | plugin_setup_required | unprotected | safeword codex migrate        |

    Scenario Outline: Unproven plugin status reflects legacy protection
      Given an enabled plugin without current proof and <legacy_fixture>
      When Safeword derives human Codex status from the fixture
      Then status reports plugin_enabled_hook_unproven with protection <protection>
      And the output recommends restarting Codex and reviewing hooks

      Examples:
        | legacy_fixture                | protection |
        | recognized legacy protection  | protected  |
        | no recognized legacy protection | unprotected |

    @rejection
    Scenario: Partial hook proof names the events still required before finalization
      Given an enabled plugin with proof for only SessionStart
      When Safeword derives the prepared Codex domain status
      Then structured status reports plugin_enabled_hook_unproven with partial proof and names the four missing hook events

    Scenario: Older Codex clients with an unknown plugin version remain compatible
      Given an enabled unknown-version plugin with current proof and legacy protection
      When Safeword derives human Codex status from the fixture
      Then status reports compatibility with protected coverage and unknown plugin observation

    Scenario: Recovery state takes precedence over legacy protection
      Given an unresolved migration backup and recognized legacy protection
      When Safeword derives human Codex status from the fixture
      Then status reports recovery_required, names protection as uncertain, and ends with safeword codex recover

    Scenario: Plugin-only human status has no next action
      Given current profile proof and a finalized project without legacy assets
      When Safeword derives human Codex status from the fixture
      Then status reports plugin, names protection as protected, and contains no Next line

    @rejection
    Scenario: Status execution error has stable machine semantics
      Given a Codex profile whose status observation fails
      When the builder requests Codex status as JSON
      Then the public JSON envelope reports PLUGIN_OBSERVATION_FAILED and exits 1

    Scenario Outline: Domain status uses state-specific complete schema
      Given the repository and active profile derive the <fixture> fixture
      When Safeword derives the prepared Codex domain status
      Then the complete migration schema 2 object reports state <state> and protection <protection>
      And it has <next_actions> next actions naming <next_command> and the command exits <exit_code>

      Examples:
        | fixture                        | state                              | protection  | next_actions | next_command                       | exit_code |
        | recovery required              | recovery_required                  | uncertain   | 1            | safeword codex recover             | 2         |
        | finalized without plugin       | plugin_setup_required              | unprotected | 1            | safeword codex migrate             | 2         |
        | disabled without legacy        | plugin_disabled                    | unprotected | 1            | safeword codex migrate             | 2         |
        | disabled with complete legacy  | plugin_disabled                    | protected   | 1            | safeword codex migrate             | 2         |
        | disabled with partial legacy   | plugin_disabled                    | partial     | 1            | safeword codex migrate             | 2         |
        | outdated plugin without legacy | plugin_update_required             | unprotected | 1            | safeword codex migrate             | 2         |
        | restart pending without legacy | plugin_installed_app_restart_required  | unprotected | 1            | Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task. | 2         |
        | restart completed without hook activation | plugin_installed_hook_activation_failed | unprotected | 1            | Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). If they are enabled and trusted, use a Codex surface that dispatches lifecycle hooks before relying on Safeword protection. | 2         |
        | restart completed with partial hook activation | plugin_enabled_hook_unproven | unprotected | 1            | Continue in this Codex session. Safeword will confirm protection after the remaining lifecycle hooks run. | 2         |
        | restart pending with complete legacy | plugin_installed_app_restart_required | protected | 1            | Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task. | 2         |
        | restart pending with partial legacy | plugin_installed_app_restart_required | partial | 1            | Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task. | 2         |
        | complete legacy                | legacy                             | protected   | 1            | safeword codex migrate             | 2         |
        | partial legacy                 | legacy                             | partial     | 1            | safeword codex migrate             | 2         |
        | unproven without legacy        | plugin_enabled_hook_unproven       | unprotected | 1            | Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task. | 2         |
        | unproven with legacy           | plugin_enabled_hook_unproven       | protected   | 1            | Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task. | 2         |
        | current proof with legacy      | compatibility                      | protected   | 1            | safeword codex migrate --finalize  | 2         |
        | current proof without legacy   | plugin                             | protected   | 0            | none                               | 0         |
        | no configuration               | not_configured                     | unprotected | 1            | safeword codex migrate             | 2         |

    Scenario Outline: Next-action shape distinguishes a runnable command from a human step
      Given the repository and active profile derive the <fixture> fixture
      When Safeword derives the prepared Codex domain status
      Then the single next action is shaped as a <shape> action

      Examples:
        | fixture                        | shape   |
        | restart pending without legacy | human   |
        | unproven without legacy        | human   |
        | disabled without legacy        | command |
        | finalized without plugin       | command |

    Scenario: Restart status preserves the schema 1 compatibility state token
      Given the released Safeword plugin is installed but Codex has not restarted
      When the builder checks the Codex plugin activation status
      Then JSON status exposes the schema 2 app-restart state and the schema 1 compatibility state

    Scenario: JSON finalization plan uses stable effect actions
      Given legacy Codex assets and current profile hook proof
      When an agent previews finalization with JSON output
      Then file effects include config update, legacy removal, plugin-marker creation, and bootstrap creation
      And every listed action is create, update, remove, or restore
      And the preview exposes a human-confirmed replay command bound to its plan id

    Scenario Outline: Finalized project setup state overrides disabled-profile detail
      Given a finalized repository whose profile plugin is <plugin_state>
      When Safeword derives human Codex status from the fixture
      Then status reports plugin_setup_required and protection unprotected

      Examples:
        | plugin_state |
        | absent       |
        | disabled     |

  @codex-continuity.NTB1.R2
  Rule: codex-continuity.NTB1.R2 — Non-interactive use never performs shared cleanup without an explicit finalization flag

    @rejection
    Scenario Outline: Non-interactive migration without complete confirmation cannot finalize
      Given current profile proof and legacy Codex assets in a non-interactive shell
      When an agent runs Codex migration with <flags>
      Then the command exits without changing the repository

      Examples:
        | flags           |
        | neither flag    |
        | finalize only   |
        | yes only        |

  @codex-continuity.SWM1.R1
  Rule: codex-continuity.SWM1.R1 — Finalization removes only known Safeword-owned legacy assets

    @rejection
    Scenario: Lookalike and user-authored assets survive finalization
      Given current profile proof and a mixture of known legacy and user-authored Codex assets
      When the builder finalizes migration
      Then only the finite Safeword legacy allowlist is removed

  @codex-continuity.SWM1.R2
  Rule: codex-continuity.SWM1.R2 — A finalized repository retains a small plugin-setup bootstrap without duplicated workflow policy

    Scenario: New teammate receives only the plugin setup path
      Given a finalized repository opened by a teammate without the profile plugin
      When the teammate reads the repository bootstrap skill
      Then it explains install, app restart, hook review, and status without embedding workflow policy

    Scenario: Finalized project tells an unconfigured teammate to install the plugin
      Given a finalized repository opened by a teammate without the profile plugin
      When the teammate checks Codex status
      Then status reports plugin_setup_required and points to the repository bootstrap

    @rejection
    Scenario: Generic setup does not install the migration bootstrap
      Given a repository that has never finalized Codex migration
      When the builder runs Safeword setup
      Then no Safeword plugin-setup bootstrap skill is created
