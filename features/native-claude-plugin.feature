# Deterministic acceptance is implemented in Vitest and isolated Claude-profile
# smoke lanes. Interactive trust and /reload-plugins checks remain opt-in and are
# recorded explicitly. @wip keeps these scenarios out of the generic Cucumber
# lane until their ticket-specific adapters are implemented.
@native-claude-plugin
Feature: Ship Safeword as a native Claude Code plugin

  Safeword's framework-owned Claude workflows ship through a versioned native
  plugin. Project state remains local, and legacy protection is retired only
  after the exact replacement has executed and cleanup is explicitly approved.

  @native-claude-plugin.TBU1.R1 @surface.claude-code @surface.safeword-cli
  Rule: native-claude-plugin.TBU1.R1 — Fresh installation establishes an observable native plugin without requiring legacy assets

    Scenario Outline: Install converges supported profile states to the exact enabled user-scoped plugin
      Given a Claude Code 2.1.170 or newer profile with <initial-state>
      When safeword claude install runs with --scope user
      Then the official marketplace and exact enabled Safeword version exist at user scope
      And every project file is byte-identical
      And unrelated profile state is byte-identical
      And the result names /reload-plugins as the sole immediate action

      Examples:
        | initial-state                                       |
        | no Safeword marketplace or plugin                   |
        | the exact official Safeword plugin disabled         |
        | an enabled older official Safeword plugin version   |

    Scenario Outline: Install converges supported official source shapes and older release tags
      Given a supported Claude profile uses the official marketplace in <source-shape> form at <marketplace-tag> with plugin <plugin-version>
      When safeword claude install runs with --scope user
      Then the official marketplace and exact enabled Safeword version exist at user scope
      And every project file is byte-identical
      And unrelated profile state is byte-identical

      Examples:
        | source-shape     | marketplace-tag | plugin-version |
        | flattened fields | v0.70.0         | 0.70.0        |
        | packed string    | v0.70.0         | 0.70.0        |
        | flattened fields | v0.71.0         | 0.71.0        |

    Scenario: Fresh setup installs the user-scoped plugin without writing legacy Claude assets
      Given a project that has never installed Safeword
      When safeword setup runs for native Claude delivery
      Then project-owned Safeword state is created
      And the exact official Safeword plugin is enabled at user scope for the current project
      And no Claude-only legacy hooks, skills, commands, or agents are materialized
      And no Cursor configuration is materialized
      And the result names /reload-plugins as the sole immediate action

    @rejection
    Scenario Outline: Install refuses an unsupported Claude host before profile mutation
      Given the Claude executable reports <version>
      When safeword claude install runs with --scope user
      Then it returns unsupported-host with profile and project state byte-identical
      And upgrading or reinstalling Claude Code is the sole safe next action

      Examples:
        | version            |
        | 2.1.169            |
        | unparseable output |

    @rejection
    Scenario: Install refuses a marketplace name that resolves to an unofficial source
      Given the active Claude profile maps the Safeword marketplace name to a different source
      When safeword claude install runs with --scope user
      Then installation fails without changing the project or the conflicting marketplace
      And the result names the official marketplace identity as the safe next action

    Scenario Outline: Install refuses malformed, noncanonical, or newer official marketplace tags
      Given the active Claude profile maps the official marketplace in <source-shape> form to <marketplace-tag>
      When safeword claude install runs with --scope user
      Then installation fails without changing the project or the conflicting marketplace
      And the result names the official marketplace identity as the safe next action

      Examples:
        | source-shape     | marketplace-tag  |
        | flattened fields | v999.0.0          |
        | packed string    | v0.71.0+shadow    |
        | flattened fields | release-0.70.0    |
        | packed string    | v0.72.0-rc.1      |

    @rejection
    Scenario: Install rejects current metadata backed by a legacy cached payload
      Given the exact enabled plugin metadata points to a cache without native identity
      When safeword claude install runs with --scope user
      Then installation fails as unverified without changing the project
      And no reload action is reported for the legacy cached payload

    @rejection
    Scenario Outline: Claude subprocess failure reports partial profile effects without project mutation
      Given a supported Claude profile whose <operation> command fails
      When safeword claude install runs with --scope user
      Then it returns errored without changing project files or unrelated profile values
      And profile files outside the observed Claude command write set are byte-identical
      And every profile effect completed before the failure is reported exactly
      And the result names one repair or retry action

      Examples:
        | operation      |
        | plugin install |
        | plugin list    |

  @native-claude-plugin.TBU1.R2 @surface.claude-code @surface.safeword-cli
  Rule: native-claude-plugin.TBU1.R2 — Plugin installation, update, coexistence, and cleanup preserve project-owned, user-authored, and third-party configuration

    Scenario Outline: Cleanup removes recognized Safeword entries from mixed Claude configuration
      Given a cleanup-ready project with <accepted-fingerprint> Safeword assets and mixed user and third-party Claude settings
      When safeword claude cleanup is confirmed
      Then only the recognized Safeword files and settings entries are removed
      And user-authored, third-party, Cursor-shared, and project-owned assets are byte-identical
      And the complete Claude profile is byte-identical to its pre-command snapshot

      Examples:
        | accepted-fingerprint          |
        | the current accepted          |
        | a historical accepted         |

    @rejection
    Scenario: Declining cleanup confirmation leaves profile and project state unchanged
      Given a cleanup-ready project and profile
      When the user declines safeword claude cleanup confirmation
      Then every profile and project file is byte-identical
      And no Claude lifecycle command is invoked

    @rejection
    Scenario: Cleanup preserves and reports unknown content at a managed legacy path
      Given a cleanup-ready project whose managed Claude skill path contains content with no accepted Safeword fingerprint
      When safeword claude cleanup is confirmed
      Then cleanup refuses to contract that project
      And the unknown content and every unrelated project file remain byte-identical

    Scenario: Ordinary setup preserves an existing legacy project and unrelated Claude profile state
      Given an existing project has viable legacy Claude protection and arbitrary profile state
      When ordinary safeword setup upgrades the project
      Then every viable legacy asset and unrelated Claude profile state are preserved
      And the result records the user plugin install and recommends reloading it

  @native-claude-plugin.TBU1.R3 @surface.claude-code @surface.safeword-cli
  Rule: native-claude-plugin.TBU1.R3 — Framework code executes from the installed versioned plugin while project state remains in the repository

    Scenario: A cached plugin resolves framework code internally and writes state to the documented boundaries
      Given the installed plugin cache is available without its source checkout or package registry
      When a Safeword plugin hook executes
      Then every framework import resolves beneath CLAUDE_PLUGIN_ROOT
      And execution proof is written beneath CLAUDE_PLUGIN_DATA
      And ticket, configuration, and runtime project state remain beneath the project root

    Scenario: Separate SessionStart hooks return host-safe responses
      Given the installed plugin cache is available without its source checkout or package registry
      When its generated SessionStart entrypoint executes
      Then Claude receives independently valid SessionStart responses containing every sibling context

    Scenario: A valid Claude lifecycle lease does not make a verified cache unsafe
      Given the installed plugin cache is available without its source checkout or package registry
      And its .in_use lifecycle lease has exact Claude ownership metadata
      When a Safeword plugin hook executes
      Then it writes plugin proof without reporting an unlisted plugin asset
      And the exact lifecycle lease remains byte-identical

    @rejection
    Scenario: A failed sibling hook prevents event-level plugin proof
      Given an intact cached UserPromptSubmit event whose final sibling hook fails
      When a Safeword plugin hook executes
      Then the aggregate event fails without writing execution proof
      And viable legacy protection remains authoritative

    @rejection
    Scenario: A generated plugin reference cannot depend on a materialized project framework copy
      Given a canonical workflow reference resolves through a project .safeword hook, guide, script, or template
      When the Claude plugin catalogue is validated
      Then validation fails naming the project-relative dependency
      And no plugin catalogue is published

  @native-claude-plugin.TBU1.R4 @surface.claude-code @surface.safeword-cli
  Rule: native-claude-plugin.TBU1.R4 — Repeating any successful lifecycle operation is idempotent and produces no unrelated repository churn

    Scenario Outline: Repeating a completed lifecycle operation is a no-op
      Given <operation> has completed successfully
      When the same <operation> runs again
      Then its owned profile or project state is byte-identical to the completed state
      And unrelated profile and project state is byte-identical
      And the versioned JSON result has the same successful terminal classification

      Examples:
        | operation                |
        | safeword claude install |
        | safeword claude cleanup |
        | safeword claude recover |

    @rejection
    Scenario: A lifecycle mutation refuses to run over a pending cleanup recovery
      Given a project has an incomplete durable Claude cleanup transaction
      When a new safeword claude cleanup runs
      Then it fails in recovery-required state without changing the project
      And the sole safe next action is safeword claude recover

    Scenario: Setup in plugin mode never recreates retired Claude legacy assets
      Given a successfully cleaned project carries its durable plugin-mode marker
      When safeword setup runs again
      Then no retired Claude hook, skill, command, or agent is recreated
      And project-owned assets remain reconciled while Cursor stays unselected

  @native-claude-plugin.TBU1.R5 @surface.claude-code @surface.safeword-cli
  Rule: native-claude-plugin.TBU1.R5 — Installed, enabled, or updated plugin behavior becomes available in the current Claude task through supported live reload whenever the host permits it

    @live
    Scenario: The next prompt after live plugin reload proves the new plugin before prompt processing
      Given an authenticated Claude task has installed or updated Safeword and supports plugin reload
      When the user submits the first prompt after /reload-plugins
      Then UserPromptSubmit records the exact installed version, hook-manifest digest, and canonical reloaded cache path before the prompt proceeds
      And status observes current-task plugin proof without requiring a restart

    @rejection @wip
    Scenario: Refused live reload leaves legacy authority intact
      Given Claude refuses /reload-plugins and the task retains a viable legacy hook
      When the next protected action occurs in the current task
      Then the viable legacy hook supplies the functional effect exactly once
      And no new exact plugin proof authorizes cleanup

  @native-claude-plugin.NTB1.R1 @surface.claude-code @surface.safeword-cli
  Rule: native-claude-plugin.NTB1.R1 — Every viable legacy hook remains authoritative until the exact installed plugin version and hook definition have executed

    Scenario: Coexisting plugin hooks prove identity but suppress duplicate work per legacy event
      Given current cleanup-authorizing SessionStart proof exists
      And a viable recognized legacy PreToolUse hook and the matching plugin hook coexist
      When the plugin PreToolUse hook executes
      Then the bundled identity is validated without writing new cleanup-authorizing proof
      And the protected functional effect occurs exactly once through the viable legacy hook

    Scenario: Plugin hooks remain functional for events without viable legacy authority
      Given no viable legacy SessionStart hook exists
      When the plugin SessionStart hook executes
      Then its functional effect occurs exactly once and exact plugin proof is recorded

    @rejection
    Scenario Outline: Invalid plugin proof cannot authorize legacy cleanup
      Given Claude lists the exact Safeword plugin as enabled but its proof is <proof-state>
      When safeword claude cleanup is confirmed
      Then cleanup returns unproven without removing or disabling any legacy asset
      And complete profile and project snapshots are unchanged
      And no marketplace, install, update, enable, reload, or trust call occurs

      Examples:
        | proof-state                              |
        | missing                                  |
        | bound to a stale plugin version          |
        | bound to the wrong hook-manifest digest  |
        | malformed                                |
        | bound to a different canonical cache path |

    Scenario: The loaded plugin becomes authoritative in the same task after cleanup
      Given the current task has exact plugin proof and is in post-cleanup state with no matching legacy authority
      When the next matching plugin event executes
      Then the plugin functional effect occurs exactly once
      And no plugin reload or task restart is required

  @native-claude-plugin.NTB1.R2 @surface.claude-code @surface.safeword-cli
  Rule: native-claude-plugin.NTB1.R2 — Missing, disabled, stale, malformed, or unproven plugin state leaves legacy protection intact and reports a safe next action

    Scenario Outline: Ready plugin states are classified without mutation
      Given the profile and project represent <state>
      When safeword claude status runs
      Then the versioned JSON classification is <classification> with exit <exit>
      And it reports <action-count> safe next action named <action>
      And profile and project bytes equal their pre-command snapshots

      Examples:
        | state                                                    | classification | exit | action-count | action                    |
        | valid proof and wholly recognized removable legacy       | cleanup-ready  | 2    | 1            | safeword claude cleanup   |
        | valid proof, durable plugin-mode marker, and no legacy    | plugin-mode    | 0    | 0            | none                      |

    @rejection
    Scenario Outline: Non-ready plugin states are classified without weakening legacy protection
      Given the project has viable legacy protection and the profile and project represent <state>
      When safeword claude status runs
      Then the versioned JSON classification is <classification> with exit <exit>
      And it reports exactly one safe next action named <action>
      And the viable legacy protection remains authoritative and unchanged
      And profile and project bytes equal their pre-command snapshots

      Examples:
        | state                                                       | classification    | exit | action                                  |
        | accompanied by an incomplete transaction                   | recovery-required | 2    | safeword claude recover                 |
        | hosted by Claude Code older than 2.1.170                    | unsupported-host  | 2    | update Claude Code                      |
        | hosted by an unparseable Claude executable                 | unsupported-host  | 2    | reinstall Claude Code                   |
        | not installed                                               | missing           | 2    | safeword install --agents=claude        |
        | installed but disabled                                      | disabled          | 2    | safeword install --agents=claude        |
        | installed at a different version                            | wrong-version     | 2    | safeword install --agents=claude        |
        | reported unhealthy by Claude                                | errored           | 1    | repair the reported Claude plugin error |
        | enabled without execution proof                              | unproven          | 2    | /reload-plugins                         |
        | proven with a stale version or digest                        | unproven          | 2    | /reload-plugins                         |
        | represented by a malformed proof record                      | unproven          | 2    | /reload-plugins                         |
        | proven from a different canonical installed cache path       | unproven          | 2    | /reload-plugins                         |
        | valid proof with recognized and conflicting legacy content   | cleanup-ready     | 2    | safeword claude cleanup                  |

    @rejection
    Scenario Outline: Damaged plugin runtime remains non-blocking and writes no plugin proof
      Given the installed plugin cache has <damage>
      When its generated UserPromptSubmit entrypoint executes
      Then the hook reports the damaged cache without blocking and writes no proof
      And viable legacy protection remains authoritative

      Examples:
        | damage                    |
        | a mismatched hook manifest |
        | a missing hook entrypoint  |
        | a modified hook runtime    |

  @native-claude-plugin.NTB1.R3 @surface.claude-code @surface.safeword-cli
  Rule: native-claude-plugin.NTB1.R3 — Cleanup never installs, upgrades, enables, reloads, or changes trust for the plugin or its marketplace

    Scenario: Successful cleanup makes no Claude lifecycle mutation
      Given a cleanup-ready project and a call-recording Claude command adapter
      When safeword claude cleanup is confirmed
      Then the cleanup transaction completes without any marketplace, install, update, enable, reload, or trust call

    @rejection
    Scenario: Rejected cleanup performs no compensating Claude lifecycle mutation
      Given cleanup preconditions fail and a call-recording Claude command adapter is present
      When safeword claude cleanup is confirmed
      Then cleanup leaves the project unchanged
      And it makes no marketplace, install, update, enable, reload, or trust call

    Scenario: Cleanup with no recognized legacy assets reports no contraction
      Given valid current plugin proof and a plugin-mode project with no Claude legacy assets
      When safeword claude cleanup is confirmed
      Then it reports plugin-mode with no next action
      And profile and project bytes are unchanged

  @wip @native-claude-plugin.NTB1.R4 @surface.claude-code @surface.safeword-cli
  Rule: native-claude-plugin.NTB1.R4 — Cleanup is atomic, recoverable after interruption, and refuses to overwrite concurrent project edits

    Scenario Outline: Recovery applies the exact disposition recorded by the durable transaction
      Given cleanup recovery records <recorded-state> and the current target has <current-fingerprint>
      When safeword claude recover runs
      Then recovery <disposition>
      And the target contains <expected-bytes>
      And the complete Claude profile is byte-identical to its pre-command snapshot
      And every non-target project path is unchanged

      Examples:
        | recorded-state    | current-fingerprint | disposition                                      | expected-bytes         |
        | complete-forward  | recorded-before     | completes the pending atomic replacement         | recorded-after bytes   |
        | restore-backup    | recorded-after      | restores the durable backup                       | recorded-before bytes  |
        | complete-forward  | unknown-concurrent  | reports recovery conflict without changing target | concurrent user bytes  |

    @rejection
    Scenario: Concurrent edits stop cleanup without overwriting the edited target
      Given a cleanup target changes after planning and before its atomic replacement
      When safeword claude cleanup attempts to commit
      Then cleanup reports a recoverable conflict
      And the concurrently edited target is byte-identical to the user's edit

    @rejection
    Scenario Outline: Cleanup refuses symlinked or escaping legacy targets before mutation
      Given a cleanup-ready project whose planned legacy target is <unsafe-target>
      When safeword claude cleanup is confirmed
      Then cleanup refuses before mutation and reports the unsafe target
      And the external target and complete project snapshot remain byte-identical

      Examples:
        | unsafe-target                         |
        | a symlink at a managed schema path    |
        | a normalized path outside the project |

  @native-claude-plugin.SWM1.R1 @surface.claude-code @surface.safeword-cli
  Rule: native-claude-plugin.SWM1.R1 — Every release carries a complete, valid Claude plugin generated from canonical Safeword assets

    Scenario: The production generation command produces the complete plugin from canonical sources
      Given the canonical hooks, skills, commands, agents, references, guides, scripts, and templates are valid
      When bun run generate:claude-plugin runs from packages/cli
      Then every required transformed asset appears exactly once beneath plugin
      And the plugin manifest and every transitive reference resolve within the package

    @rejection
    Scenario: Generation fails on a missing transitive runtime dependency
      Given a canonical Claude skill references a required guide absent from the generated catalogue
      When the Claude plugin catalogue is generated
      Then generation fails naming the missing dependency and its referrer
      And the partial catalogue is not accepted

    @rejection
    Scenario: Generation rejects a duplicate invocation name across skills and commands
      Given canonical Claude assets define a skill and flat command with the same invocation name
      When the Claude plugin catalogue is generated
      Then generation fails naming both conflicting canonical sources
      And no ambiguous workflow is packaged

  @wip @native-claude-plugin.SWM1.R2 @surface.claude-code @surface.safeword-cli
  Rule: native-claude-plugin.SWM1.R2 — Version, hook, skill, command, agent, schema, documentation, and package contracts fail visibly when the Claude delivery surfaces drift

    Scenario: An aligned release contract passes without modifying generated assets
      Given package, marketplace, generated identity, schema, documentation, and plugin inventories match canonical sources
      When the Claude plugin release contract runs
      Then it passes with no generated diff

    @rejection
    Scenario Outline: Each Claude delivery drift fails with the offending surface
      Given the release fixture contains <drift>
      When the Claude plugin release contract runs
      Then it fails naming <surface> and the expected canonical value

      Examples:
        | drift                                      | surface       |
        | a marketplace and package version mismatch | version       |
        | an identity and hook manifest digest mismatch | hooks       |
        | a missing or unexpected skill              | skills        |
        | a missing or unexpected command            | commands      |
        | a missing or unexpected agent              | agents        |
        | an unregistered generated template         | schema        |
        | stale installation or migration guidance   | documentation |
        | a missing packaged runtime asset            | package       |

  @wip @native-claude-plugin.SWM1.R3 @surface.claude-code @surface.safeword-cli
  Rule: native-claude-plugin.SWM1.R3 — The reference workflow remains behaviorally aligned across Claude, Codex, and Cursor wherever each host exposes an equivalent native surface

    Scenario: Equivalent host workflows and lifecycle events share canonical parity identities
      Given Claude, Codex, and Cursor catalogues expose their supported Safeword surfaces
      When cross-host parity is validated
      Then every equivalent workflow and lifecycle event maps to one canonical identity
      And namespace, matcher, lifecycle, status-line, and materialization exceptions are explicit

    @rejection
    Scenario: An equivalent workflow missing from one supported host fails parity
      Given a canonical workflow has a native equivalent on Claude, Codex, and Cursor but one host omits it
      When cross-host parity is validated
      Then validation fails naming the canonical identity and missing host

  @wip @native-claude-plugin.SWM1.R4 @surface.claude-code @surface.safeword-cli
  Rule: native-claude-plugin.SWM1.R4 — Automated cache and host-surface smoke tests prove packaged execution, with unavoidable manual trust boundaries recorded explicitly

    Scenario: Installed cache executes after its marketplace source plugin directory is unavailable
      Given an isolated profile retains marketplace metadata and an installed Safeword cache but its source plugin directory is unavailable
      When Claude starts with init-only against that profile
      Then Setup executes from the versioned installed cache and writes cache-smoke evidence
      And no cleanup-authorizing plugin proof is written
      And degraded marketplace source health is reported separately from cache execution

    @rejection
    Scenario Outline: Damaged installed cache fails as cache integrity rather than marketplace health
      Given an isolated profile has healthy marketplace metadata but its installed cache has <damage>
      When Claude starts with init-only against that profile
      Then no Safeword hook proof is written
      And the smoke result reports cache integrity failure rather than marketplace health

      Examples:
        | damage                       |
        | a missing hook entrypoint    |
        | a digest-invalid hook bundle |

    @rejection
    Scenario: Missing marketplace metadata cannot be mistaken for successful cache execution
      Given an isolated profile retains cache files but has no marketplace metadata that discovers the plugin
      When Claude starts with init-only against that profile
      Then no Safeword hook proof is written
      And the smoke result fails rather than inferring execution from cache presence

    Scenario Outline: Interactive host boundaries are recorded rather than silently skipped
      Given automation cannot safely drive <boundary>
      When the host-surface acceptance report is produced
      Then <boundary> is recorded as an explicit skip with its boundary-specific reason

      Examples:
        | boundary                                 |
        | interactive marketplace and plugin trust |
        | /reload-plugins in an authenticated task  |
