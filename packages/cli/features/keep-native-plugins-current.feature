@manual @surface.claude-code @surface.openai-codex @surface.safeword-cli
Feature: Keep native Safeword plugins current

  @keep-native-plugins-current.TBU1.R1
  Rule: keep-native-plugins-current.TBU1.R1 — Stable installations advance only through their host lifecycle

    Scenario Outline: Stable installations resolve the verified stable channel
      Given an eligible stable <host> installation resolves the previous stable channel
      When the verified stable channel advances
      Then the host marketplace resolves the new verified Safeword release

      Examples:
        | host        |
        | Claude Code |
        | Codex       |

    @rejection
    Scenario: An unavailable stable update preserves the installed release
      Given an eligible stable installation has a working Safeword plugin
      When its host cannot fetch the stable channel
      Then the installed working release remains available

  @keep-native-plugins-current.TBU1.R2
  Rule: keep-native-plugins-current.TBU1.R2 — Explicit version selections remain outside stable

    Scenario Outline: Explicit selections remain pinned
      Given a Safeword plugin installation selects an exact <kind> tag
      When a newer stable release is promoted
      Then the installation remains on its selected tag

      Examples:
        | kind       |
        | exact stable release |
        | prerelease |

    @rejection
    Scenario: Stable enrollment never rewrites a prerelease pin
      Given a Safeword plugin installation selects a prerelease tag
      When Safeword checks stable-channel eligibility
      Then the prerelease declaration remains unchanged

  @keep-native-plugins-current.TBU1.R3
  Rule: keep-native-plugins-current.TBU1.R3 — Host update opt-outs remain authoritative

    Scenario: Disabled native updates remain disabled
      Given an eligible Safeword marketplace has native auto-update disabled
      When Safeword checks the marketplace declaration
      Then Safeword does not enable or bypass native updates

    @rejection
    Scenario: Maintenance does not silently override an update opt-out
      Given a builder explicitly disabled native marketplace updates
      When the builder runs ordinary Safeword maintenance
      Then the opt-out remains unchanged

  @keep-native-plugins-current.TBU1.R4
  Rule: keep-native-plugins-current.TBU1.R4 — First legacy upgrade installs native Codex and removes recognized legacy assets transactionally

    Scenario: Eligible legacy upgrade leaves native plugin and one bootstrap
      Given a project has a recognized unmodified legacy Codex installation
      And the active profile can install the stable Safeword plugin
      When the builder performs the first eligible upgrade
      Then the stable Safeword Codex plugin is installed for the active profile
      And every recognized legacy Codex asset is backed up and removed
      And the enrollment bootstrap is the only retained compatibility asset

    @rejection
    Scenario: Failed native installation preserves the complete legacy installation
      Given a project has a recognized unmodified legacy Codex installation
      And the active profile cannot install the stable Safeword plugin
      When the builder performs the first eligible upgrade
      Then the legacy installation remains complete
      And the warning gives exactly one retry action

  @keep-native-plugins-current.TBU1.R5
  Rule: keep-native-plugins-current.TBU1.R5 — Later developers enroll only their own profile

    Scenario: New collaborator enrolls without repository churn
      Given a migrated project and a collaborator profile without Safeword
      When the collaborator starts their first Codex task in the project
      Then the stable Safeword plugin is installed for that profile
      And no repository file is rewritten

    @rejection
    Scenario: One profile's enrollment never marks another profile enrolled
      Given two collaborator profiles use the same migrated project
      When the first profile enrolls successfully
      Then the second profile remains independently unenrolled

  @keep-native-plugins-current.NTB1.R1
  Rule: keep-native-plugins-current.NTB1.R1 — Ordinary stable releases need no repeated installer command

    Scenario: Later stable release needs no repeated Safeword command
      Given a builder previously enrolled in the stable channel
      When the stable channel advances to a later verified release
      Then the enrolled native source resolves it without another Safeword setup or migration command

    @rejection
    Scenario: Native update failure does not request project migration again
      Given an enrolled builder whose host update fails temporarily
      When Safeword reports the update failure
      Then the recovery does not ask the builder to migrate the project again

  @keep-native-plugins-current.NTB1.R2
  Rule: keep-native-plugins-current.NTB1.R2 — Pending activation has one plain next-session action

    Scenario Outline: Current session receives the host-appropriate activation action
      Given <host> installed a newer Safeword plugin after the current session loaded
      When Safeword reports activation pending
      Then the builder is told only to <action>

      Examples:
        | host        | action                         |
        | Claude Code | reload plugins                 |
        | Codex       | start a new Codex app session  |

    @rejection
    Scenario: Installation metadata alone never claims current-task activation
      Given a host reports the current Safeword plugin installed
      And the current task has no exact native proof
      When Safeword reports readiness
      Then readiness does not claim Safeword is active in the task

  @keep-native-plugins-current.NTB1.R3
  Rule: keep-native-plugins-current.NTB1.R3 — Failed updates preserve last-known-good protection

    Scenario: Invalid update candidate leaves the working plugin available
      Given a builder has a working Safeword plugin
      When the native updater rejects a newer candidate
      Then the working plugin remains available

    @rejection
    Scenario: Failed update never reports the rejected candidate active
      Given the native updater rejected a newer Safeword candidate
      When the builder checks readiness
      Then readiness identifies the previously working plugin as installed

  @keep-native-plugins-current.NTB1.R4
  Rule: keep-native-plugins-current.NTB1.R4 — Failed channel migration gives one resumable recovery action

    Scenario: Interrupted channel migration explains one retry
      Given a trusted Safeword marketplace declaration cannot be migrated completely
      When Safeword reports the interruption
      Then the previous working state remains recoverable
      And the builder receives exactly one retry action

    @rejection
    Scenario: Channel migration failure is never silent
      Given a trusted marketplace migration fails
      When ordinary maintenance finishes
      Then maintenance reports the failure prominently

  @keep-native-plugins-current.NTB1.R5
  Rule: keep-native-plugins-current.NTB1.R5 — Eligible pre-plugin projects migrate without human confirmation

    Scenario: Ordinary upgrade automatically enters native plugin mode
      Given a project has an eligible pre-plugin Codex installation
      When the builder runs ordinary Safeword upgrade
      Then migration proceeds without a dedicated migration command or confirmation

    @rejection
    Scenario: Ambiguous legacy content is not removed automatically
      Given a project has user-edited or unrecognized Codex legacy content
      When the builder runs ordinary Safeword upgrade
      Then the ambiguous content remains unchanged
      And maintenance reports why automatic cleanup was skipped

  @keep-native-plugins-current.NTB1.R6
  Rule: keep-native-plugins-current.NTB1.R6 — Every Codex task reports unready native protection prominently

    Scenario: Installed but unloaded plugin warns at task start
      Given the profile plugin is installed but not proven active in the current Codex task
      When the Codex task starts
      Then a prominent warning says Safeword is not protecting this task
      And the warning gives one next-task action

    @rejection
    Scenario: Exact current proof keeps startup quiet
      Given exact profile project version and task proof exists
      When the Codex task starts
      Then no unready warning is shown

  @keep-native-plugins-current.NTB1.R7
  Rule: keep-native-plugins-current.NTB1.R7 — Unready tasks may continue after the warning

    Scenario: Unready task can still change project files
      Given the startup warning says Safeword is not active
      When the builder continues with an edit
      Then Safeword does not intercept or block the edit

    @rejection
    Scenario: Readiness warning installs no mutation gate
      Given enrollment has not completed
      When the bootstrap configures project hooks
      Then no edit or shell-command interception hook is installed

  @keep-native-plugins-current.NTB1.R8
  Rule: keep-native-plugins-current.NTB1.R8 — Readiness warnings explain risk and one recovery action plainly

    Scenario: Pending activation warning is understandable without plugin terminology
      Given enrollment succeeded but the current task cannot load the plugin
      When readiness is reported
      Then the message says work may continue without Safeword protection
      And gives exactly one action to restore protected work

    @rejection
    Scenario: Readiness warning does not claim work is blocked
      Given the current task is unprotected
      When readiness is reported
      Then the message does not say edits or commands are disabled

  @keep-native-plugins-current.NTB1.R9
  Rule: keep-native-plugins-current.NTB1.R9 — Failed enrollment names the cause while allowing work

    Scenario: Enrollment failure reports cause and retry without blocking
      Given automatic profile enrollment fails for an understandable cause
      When the bootstrap reports readiness
      Then the warning names that cause and gives exactly one retry action
      And says the builder may continue without Safeword protection

    @rejection
    Scenario: Enrollment failure never installs a mutation blocker
      Given automatic profile enrollment failed
      When the builder continues the Codex task
      Then Safeword does not block edits or potentially mutating commands

  @keep-native-plugins-current.SWM1.R1
  Rule: keep-native-plugins-current.SWM1.R1 — Both hosts share one stable release identity

    Scenario: Stable channel identifies the same release for both hosts
      Given a verified stable Safeword release is promoted
      When Claude Code and Codex resolve the stable channel
      Then both host plugins identify the same Safeword version

    @rejection
    Scenario: Cross-host version disagreement fails the release contract
      Given the Claude and Codex plugin manifests identify different releases
      When the stable release contract runs
      Then promotion is refused

  @keep-native-plugins-current.SWM1.R2
  Rule: keep-native-plugins-current.SWM1.R2 — Stable advances only after verified publication

    Scenario: Successful stable publication advances the channel
      Given a non-prerelease package publication succeeds and is verified
      When release promotion runs
      Then the stable channel advances to that release commit

    @rejection
    Scenario Outline: Ineligible publication leaves stable unchanged
      Given the release is <outcome>
      When release promotion is considered
      Then the previous stable channel remains authoritative

      Examples:
        | outcome                |
        | a prerelease           |
        | unpublished            |
        | published but unverified |

  @keep-native-plugins-current.SWM1.R3
  Rule: keep-native-plugins-current.SWM1.R3 — Failed promotion leaves previous stable authoritative

    Scenario: Promotion failure preserves stable
      Given a verified package was published but stable-channel promotion fails
      When the release workflow finishes
      Then the previous stable channel remains authoritative
      And maintainers receive a visible failure

    @rejection
    Scenario: Failed promotion never partially moves stable
      Given stable-channel publication cannot complete atomically
      When promotion fails
      Then no consumer resolves a partially promoted channel

  @keep-native-plugins-current.SWM1.R4
  Rule: keep-native-plugins-current.SWM1.R4 — Migration rewrites only trusted official declarations

    Scenario Outline: Trusted legacy declaration migrates to stable
      Given the official Safeword marketplace uses <legacy-ref>
      When ordinary maintenance migrates its channel
      Then only that declaration selects the stable channel

      Examples:
        | legacy-ref          |
        | the default branch  |
        | an older exact release tag |

    @rejection
    Scenario: Unrelated host configuration survives channel migration
      Given a trusted Safeword declaration and unrelated host configuration
      When ordinary maintenance migrates the Safeword channel
      Then the unrelated configuration remains unchanged

  @keep-native-plugins-current.SWM1.R5
  Rule: keep-native-plugins-current.SWM1.R5 — Unsafe declarations remain untouched

    Scenario Outline: Unsafe declaration requires explicit resolution
      Given a Safeword-named marketplace declaration is <kind>
      When ordinary maintenance checks channel migration
      Then the declaration remains unchanged and is reported for explicit resolution

      Examples:
        | kind                  |
        | malformed             |
        | a third-party fork    |
        | pinned newer than this CLI |

    @rejection
    Scenario: Repository-name similarity is insufficient trust
      Given a third-party repository is also named Safeword
      When ordinary maintenance checks channel migration
      Then it is not rewritten as the official marketplace

  @keep-native-plugins-current.SWM1.R6
  Rule: keep-native-plugins-current.SWM1.R6 — Bootstrap is the only retained Codex compatibility asset and becomes inert after proof

    Scenario: Proven native task makes bootstrap a no-op
      Given a migrated project and exact current native SessionStart proof
      When the enrollment bootstrap runs
      Then it changes neither the profile nor the repository and emits no warning

    @rejection
    Scenario: Migration leaves no legacy functional dispatcher
      Given eligible legacy Codex migration completes
      When the retained project compatibility assets are inspected
      Then only the enrollment bootstrap remains

  @keep-native-plugins-current.SWM1.R7
  Rule: keep-native-plugins-current.SWM1.R7 — Concurrent profile mutations serialize and converge

    Scenario: Simultaneous tasks share one profile enrollment
      Given two Codex tasks start against the same unenrolled profile
      When both enrollment bootstraps run concurrently
      Then only one operation mutates the profile
      And both tasks observe one complete installed state

    @rejection
    Scenario: Non-owner never removes a live profile lock
      Given one task owns a live profile enrollment lock
      When another task encounters the lock
      Then the second task neither mutates the profile nor removes the lock

  @keep-native-plugins-current.SWM1.R8
  Rule: keep-native-plugins-current.SWM1.R8 — Enrollment evidence remains profile-local

    Scenario: Separate profiles enroll independently in one repository
      Given two developers use one migrated repository with separate Codex profiles
      When both start their first tasks
      Then each profile records only its own installation and proof
      And the repository remains unchanged

    @rejection
    Scenario: Profile proof is never committed as repository state
      Given a developer completes native activation
      When enrollment evidence is stored
      Then no installed or proven marker is written to the repository

  @keep-native-plugins-current.SWM1.R9
  Rule: keep-native-plugins-current.SWM1.R9 — Concurrent releases cannot move stable backward

    Scenario: Older release finishing last cannot replace newer stable
      Given a newer verified release promotes before an older release workflow finishes
      When the older workflow attempts promotion
      Then stable remains on the newer release

    @rejection
    Scenario: Stable promotion never force-updates the channel
      Given stable is not an ancestor of a proposed promotion target
      When promotion runs
      Then promotion fails without moving stable
