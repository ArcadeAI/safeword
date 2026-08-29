@surface.safeword-cli @feature.unified-first-time-install
Feature: One coherent Safeword command model

  @unified-first-time-install.TBU1.R1
  Rule: unified-first-time-install.TBU1.R1 — One install reconciles the project and installs both native profile plugins

    @surface.claude-code @surface.openai-codex
    Scenario: Default install configures core Claude and Codex but not Cursor
      Given an unconfigured project with available Claude and Codex hosts
      When the user runs the canonical install command without an agent selector
      Then core project configuration and both profile plugins are installed
      And Cursor configuration is unchanged

    @rejection
    Scenario: Offline default install refuses before changing any surface
      Given an unconfigured project whose default installation requires network access
      When the user runs the canonical install command offline
      Then no project profile or Cursor effect occurs
      And an online next action is reported

  @unified-first-time-install.TBU1.R2
  Rule: unified-first-time-install.TBU1.R2 — Agent selectors narrow installation to exactly the selected integrations

    Scenario Outline: A valid selector changes only the requested integrations
      Given an unconfigured project with all agent hosts available
      When the user installs with agents "<agents>"
      Then core project configuration is installed
      And exactly the "<agents>" integrations are changed
      Examples:
        | agents       |
        | claude       |
        | codex        |
        | claude,codex |

    @rejection
    Scenario: An unknown agent selector is rejected before mutation
      Given an unconfigured project
      When the user installs with agents "unknown"
      Then the selector error names the supported values
      And no project or agent effect occurs

    Scenario: Duplicate agent values are normalized to one integration
      Given an unconfigured project with the Claude host available
      When the user installs with agents "claude,claude"
      Then core project configuration and Claude are installed once
      And Codex and Cursor are unchanged

    Scenario: Project-only installation works offline
      Given an unconfigured project whose core assets are locally available
      When the user installs offline with agents "none"
      Then core project configuration is installed without a network effect
      And every agent integration is unchanged

    Scenario: Explicit Cursor installation works offline when core dependencies are satisfied
      Given an unconfigured project whose core dependencies and Cursor assets are locally available
      When the user installs offline with agents "cursor"
      Then core project configuration and Cursor assets are installed without a network effect
      And Claude and Codex are unchanged

    Scenario: Non-destructive install can run without input
      Given an installation whose selected effects require no destructive consent
      When the user installs without input
      Then the selected installation completes without prompting

    @rejection
    Scenario: None combined with an integration is rejected before mutation
      Given an unconfigured project
      When the user installs with agents "none,claude"
      Then the selector error explains that none must be used alone
      And no project or agent effect occurs

  @unified-first-time-install.TBU1.R3
  Rule: unified-first-time-install.TBU1.R3 — Default installation leaves Cursor configuration untouched

    @surface.cursor
    Scenario: Existing Cursor configuration survives default install byte-for-byte
      Given a project with customer-owned Cursor configuration
      When the user runs the canonical install command without an agent selector
      Then every Cursor file remains byte-for-byte unchanged

    @rejection @surface.cursor
    Scenario: Default install does not create missing Cursor configuration
      Given a project with no Cursor configuration
      When the user runs the canonical install command without an agent selector
      Then no Cursor file or directory is created

  @unified-first-time-install.TBU1.R4
  Rule: unified-first-time-install.TBU1.R4 — Cursor configuration is created only when cursor appears in agents

    @surface.cursor
    Scenario: Explicit Cursor install reconciles its project-local assets
      Given a project with no Cursor configuration
      When the user installs with agents "cursor"
      Then core project configuration and Safeword-owned Cursor assets are installed
      And Claude and Codex profiles are unchanged

    @rejection @surface.cursor
    Scenario: Explicit Cursor install preserves customer and third-party Cursor content
      Given a project with customer and third-party Cursor configuration
      When the user installs with agents "cursor"
      Then Safeword Cursor entries are reconciled without replacing unrelated content

  @unified-first-time-install.TBU1.R5
  Rule: unified-first-time-install.TBU1.R5 — Repeated installation converges safely across the selected surfaces

    Scenario: A second identical unified install reports no changes
      Given core Claude and Codex already match the requested release
      When the user repeats the default install
      Then every surface remains unchanged and the result is healthy

    Scenario: Install repairs drift and completes a partial installation without duplication
      Given core configuration has drifted Claude is already healthy and Codex is missing
      When the user repeats the default install
      Then core drift is reconciled and Codex is installed
      And healthy Claude state and user-owned content are preserved without duplicate entries

    @rejection
    Scenario: A failed surface does not roll back successful surfaces
      Given core and Codex can install but Claude installation fails
      When the user runs the default install
      Then successful core and Codex effects remain recorded
      And Claude is the only failed surface offered for retry

    Scenario: An enrolled project does not hide a failed Claude retry behind reload advice
      Given an enrolled project whose Claude plugin is missing and cannot reinstall
      When the user runs the default install
      Then Claude is the only failed surface offered for retry

    Scenario: Targeted retry converges only the surface that previously failed
      Given core and Codex succeeded while Claude failed on the prior install
      When the user runs the reported Claude retry
      Then Claude converges to healthy
      And core and Codex are not installed again

  @unified-first-time-install.TBU2.R1
  Rule: unified-first-time-install.TBU2.R1 — Status and doctor are observably different commands

    Scenario: Status gives a concise aggregate while doctor explains causes and coverage
      Given a configured project with one profile action required
      When the user compares canonical status with doctor
      Then both report the same health state
      And only doctor includes causal diagnostics and coverage detail

    @rejection
    Scenario: The catalogue forbids status and doctor from sharing one handler contract
      Given the public command catalogue and handlers
      When command contracts are validated
      Then status and doctor have distinct executable fixtures and observable output

  @unified-first-time-install.TBU2.R2
  Rule: unified-first-time-install.TBU2.R2 — Planning covers every selected lifecycle effect without mutation

    Scenario Outline: Plan declares all effects for the selected lifecycle scope
      Given an installation state with agents "<agents>"
      When the user previews "<operation>" for that selection
      Then project profile network destructive and manual effects are declared when applicable
      And no effect is applied
      Examples:
        | operation | agents              |
        | install   | none                |
        | install   | claude              |
        | install   | codex               |
        | install   | claude,codex        |
        | install   | cursor              |
        | uninstall | none                |
        | uninstall | claude              |
        | uninstall | codex               |
        | uninstall | claude,codex        |
        | uninstall | cursor              |
        | uninstall | claude,codex,cursor |

    Scenario: A user-scoped Claude plan observes only the user profile
      Given a default unified installation
      When the user previews user-scoped Claude uninstall
      Then the plan preserves user scope and excludes project-scoped Claude removal
      And no effect is applied

    @rejection
    Scenario: A lifecycle effect absent from its plan blocks apply
      Given an apply would require an effect not present in the reviewed plan
      When the user confirms that plan
      Then the unplanned effect is refused and recovery guidance is returned

  @unified-first-time-install.TBU2.R3
  Rule: unified-first-time-install.TBU2.R3 — Uninstallation reverses only recognized Safeword-owned state after exact-plan confirmation

    Scenario: Unqualified uninstall previews every supported surface
      Given a default unified installation
      When the user runs uninstall without confirmation
      Then an exact plan covers project, Claude, Codex, and Cursor
      And no state is changed

    Scenario: Confirmed uninstall preserves custom and third-party content
      Given an exact uninstall plan and unrelated project and profile content
      When the user confirms that exact plan
      Then only recognized Safeword-owned state is removed
      And backup and recovery actions are reported where required

    @rejection
    Scenario: A stale uninstall plan is refused
      Given selected state changed after an uninstall plan was previewed
      When the user confirms that stale uninstall plan
      Then no removal occurs and a fresh plan is required

    @rejection
    Scenario: No-input uninstall never infers destructive consent
      Given an exact uninstall plan has not been confirmed
      When the user runs uninstall without input
      Then the plan is reported without applying any removal

  @unified-first-time-install.TBU2.R4
  Rule: unified-first-time-install.TBU2.R4 — Canonical architecture options distinguish index input from output staging

    Scenario Outline: Canonical architecture flags independently select input and staging
      Given architecture documents can be generated from worktree or index state
      When the user runs architecture with "<flags>"
      Then generation reads "<input>" state and leaves output "<output>"
      Examples:
        | flags                       | input    | output   |
        |                             | worktree | unstaged |
        | --from-index                | index    | unstaged |
        | --from-index --stage-output | index    | staged   |

    Scenario Outline: Legacy architecture flags retain their exact behavior
      Given a project with different worktree and index architecture
      When the user runs architecture with legacy flag "<flag>"
      Then it behaves like canonical flags "<canonical>" and reports compatibility guidance
      Examples:
        | flag     | canonical                     |
        | --staged | --from-index                  |
        | --stage  | --from-index --stage-output   |

    Scenario Outline: Canonical architecture flags are differential-tested against legacy behavior
      Given divergent worktree and index inputs with an existing generated document
      When legacy "<legacy>" and canonical "<canonical>" run in equivalent isolated fixtures
      Then generated content and index staging effects are identical
      Examples:
        | legacy   | canonical                   |
        | --staged | --from-index                |
        | --stage  | --from-index --stage-output |

    @rejection
    Scenario: Stage output without a reproducible input is rejected
      Given architecture output cannot be tied to a reproducible source state
      When the user requests staged output
      Then staging is refused and the required input selection is named

  @unified-first-time-install.TBU2.R5
  Rule: unified-first-time-install.TBU2.R5 — Global JSON is the sole canonical machine-output contract

    Scenario Outline: Every lifecycle command renders one stable JSON envelope
      Given the canonical lifecycle command "<command>"
      When the user requests global JSON output
      Then stdout contains one versioned result envelope and no prose
      Examples:
        | command   |
        | install   |
        | status    |
        | doctor    |
        | plan      |
        | uninstall |

    Scenario Outline: Every public relay recovery command renders the same machine contract
      Given the public relay recovery command "<command>"
      When the user requests global JSON output
      Then stdout contains one versioned result envelope and no prose
      And capabilities lists the relay recovery command
      Examples:
        | command                                                        |
        | retro-relay-retry                                              |
        | retro-relay-discard 00000000-0000-4000-8000-000000002251       |

    @rejection
    Scenario Outline: Legacy raw JSON remains compatible but is not advertised as canonical
      Given historical raw JSON command "<command>"
      When the user requests its legacy raw format
      Then the legacy shape is preserved with compatibility guidance outside stdout
      And help and capabilities identify global JSON as canonical
      Examples:
        | command           |
        | project test-plan |
        | retro signals     |

  @unified-first-time-install.TBU2.R6
  Rule: unified-first-time-install.TBU2.R6 — Every shipped alias remains executable but is excluded from the canonical quick path

    Scenario Outline: Existing command and option aliases keep their named canonical behavior indefinitely
      Given the retained compatibility route "<alias>" for "<canonical>"
      When the user invokes it
      Then the named canonical behavior runs with compatibility guidance
      And metadata schedules no deletion date
      Examples:
        | alias                 | canonical                              |
        | bare safeword         | status                                 |
        | setup                 | install                                |
        | claude install        | install --agents=claude (also reconciles the project) |
        | codex install         | install --agents=codex (also reconciles the project)  |
        | remove                | uninstall --agents=none                |
        | check                 | status                                 |
        | upgrade               | install                                |
        | diff                  | plan                                   |
        | reset                 | uninstall --agents=none                |
        | sync-config           | project sync-config                    |
        | architecture          | project architecture                   |
        | sync-learnings        | project sync-learnings                 |
        | sync-tickets          | project sync-tickets                   |
        | codify                | project codify                         |
        | test-plan             | project test-plan                      |
        | lint-gherkin          | project lint-gherkin                   |
        | sync-tracker          | tracker sync                           |
        | connect               | tracker connect                        |
        | self-report           | retro signals                          |
        | retro                 | retro run                              |
        | retro-reconcile       | retro reconcile                        |
        | migrate codex-plugin  | codex migrate                          |
        | --remove-legacy-hooks | codex migrate --finalize               |
        | --stage               | --from-index --stage-output            |
        | --staged              | --from-index                           |

    Scenario: Specialized canonical commands remain first-class operations
      Given migration cleanup recovery and project commands outside the unified lifecycle
      When the canonical command catalogue is validated
      Then each specialized operation retains its own behavior and effect policy
      And only its alternate spelling is marked as a compatibility alias

    Scenario: Setup yes is accepted and explicitly reported as redundant
      Given setup is a retained compatibility route for non-destructive install
      When the user runs setup with yes
      Then unified installation runs without inferring additional consent
      And compatibility guidance reports that yes is redundant and names install

    @rejection
    Scenario Outline: Profile-only aliases reject project lifecycle options they do not implement
      Given retained profile-only alias "<alias>"
      When the user supplies irrelevant option "<option>"
      Then the parser rejects the option before any profile mutation
      And the alias remains documented as retained indefinitely
      Examples:
        | alias          | option          |
        | claude install | --no-modify     |
        | codex install  | --agents=cursor |
        | codex install  | --scope=user    |

    Scenario Outline: Nontrivial aliases preserve their defined observable contract
      Given compatibility route "<alias>"
      When its behavior is compared with "<canonical>"
      Then the observable contract remains "<invariant>"
      Examples:
        | alias   | canonical               | invariant                                             |
        | setup   | install                 | core Claude and Codex install while Cursor is omitted |
        | upgrade | install                 | core Claude and Codex converge while Cursor is omitted |
        | diff    | plan                    | selected effects are reported without mutation       |
        | remove  | uninstall --agents=none | project-only removal requires an exact plan           |
        | reset   | uninstall --agents=none | project-only removal requires an exact plan           |

    Scenario: The exhaustive reference includes review and destructive guidance commands
      Given canonical review run and codex clean-guidance commands
      When CLI reference and capability fixtures are validated
      Then both commands are listed with their executable syntax and effect policy
      And codex clean-guidance is described as destructive deactivation

    @rejection
    Scenario: Ordinary help teaches only canonical routes
      Given canonical commands and retained compatibility aliases
      When the user requests ordinary help
      Then the quick path omits aliases where hiding is supported
      And one compatibility section documents every retained route

  @unified-first-time-install.NTB1.R1
  Rule: unified-first-time-install.NTB1.R1 — Results identify project Claude and Codex outcomes separately

    Scenario: Unified install reports a per-surface completion summary
      Given core Claude and Codex installation all succeed
      When the user runs the default install
      Then the human result names each surface and its outcome
      And Cursor is identified as not selected

    @rejection
    Scenario: A summary never collapses mixed outcomes into success
      Given selected surfaces finish with healthy changed and failed outcomes
      When the unified result is rendered
      Then the aggregate requires action and preserves every per-surface outcome

    Scenario: A non-technical builder can act on the summary without knowing the architecture
      Given a unified install completed with one surface requiring action
      When a non-technical builder reads the human summary
      Then they can identify what is ready what failed and the next action
      And no project profile plugin or reconciliation vocabulary is required

    Scenario: A technical builder can inspect evidence and retry only the failed scope
      Given a unified install completed with mixed per-surface outcomes
      When a technical builder requests verbose or JSON detail
      Then the selected scope and exact per-surface evidence are available
      And the failed surface has a targeted retry that does not repeat successful work

  @unified-first-time-install.NTB1.R2
  Rule: unified-first-time-install.NTB1.R2 — Manual reload or restart requirements remain unfinished activation steps

    @surface.claude-code @surface.openai-codex
    Scenario: Install completion reports exact activation actions for both profile plugins
      Given Claude and Codex profile installation succeeds
      When the unified result is rendered
      Then Claude reload and Codex restart plus task-resume actions are shown separately

    @rejection @surface.claude-code @surface.openai-codex
    Scenario: Installed plugins are not reported active before host proof
      Given profile plugins are installed but activation proof is pending
      When status is observed
      Then activation remains action-required and no active claim is made

  @unified-first-time-install.NTB1.R3
  Rule: unified-first-time-install.NTB1.R3 — A partial failure names what failed without hiding successful work

    Scenario: Missing Claude leaves core and Codex success visible
      Given core and Codex succeed while the Claude host is unavailable
      When the default install completes
      Then the result records core and Codex effects and names Claude unavailable
      And the next action retries only Claude

    @rejection
    Scenario: A failed profile install cannot produce a healthy aggregate
      Given one selected profile install fails after another surface succeeds
      When the unified result is finalized
      Then the aggregate is action-required or failed and never healthy

  @unified-first-time-install.NTB1.R4
  Rule: unified-first-time-install.NTB1.R4 — Destructive commands say what they deactivate preserve back up and recover

    Scenario: Destructive help and plans name deactivation backup and recovery effects
      Given uninstall and legacy cleanup commands
      When the user inspects help and previews each command
      Then descriptions identify deactivated state preserved content backups and recovery paths

    @rejection
    Scenario: A destructive operation cannot describe itself as backup-only
      Given a command moves active guidance out of service into a backup
      When its catalogue and human plan are rendered
      Then both call the operation destructive deactivation rather than only a backup

    Scenario: Recoverable destructive work can be restored without replacing unrelated content
      Given a confirmed cleanup moved recognized Safeword state into a recovery backup
      When the user runs the advertised recovery action
      Then the recognized state is restored to service
      And unrelated current project and profile content remains unchanged
