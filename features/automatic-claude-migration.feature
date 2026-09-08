@automatic-claude-migration
Feature: Migrate legacy Claude projects automatically

  @automatic-claude-migration.NTB1.R1 @surface.claude-code @surface.safeword-cli
  Rule: automatic-claude-migration.NTB1.R1 — A proven plugin automatically contracts every exact legacy asset while preserving and reporting unknown content without blocking work

    Scenario Outline: A released legacy project contracts after the exact plugin handles a prompt
      Given a clean legacy Claude project installed from Safeword <legacy-version>
      And the exact current plugin is effective for that repository
      When its UserPromptSubmit event completes successfully
      Then every asset in that release's independent manifest and its legacy settings entry is removed
      And the project enters durable plugin mode without blocking the prompt

      Examples:
        | legacy-version |
        | 0.68.0         |
        | 0.69.0         |
        | 0.72.0         |

    Scenario: Modified and third-party content survives partial automatic contraction
      Given a proven legacy project contains accepted assets, a modified Safeword file, a modified Safeword hook, and a third-party hook
      When its UserPromptSubmit event completes successfully
      Then accepted legacy content is removed and every unknown byte is preserved
      And the prompt continues with one plain-language advisory naming the preserved paths

    Scenario: Mixed Claude settings lose only exact historical Safeword entries
      Given a proven legacy project settings file contains an accepted Safeword hook, a modified Safeword hook, a third-party hook, and unrelated settings
      When its UserPromptSubmit event completes successfully
      Then only the accepted Safeword hook is removed from that settings file
      And the parsed values and array order of every modified, third-party, and unrelated settings entry are unchanged
      And every untouched settings byte, comment, and whitespace region is preserved exactly
      And one plain-language advisory names the preserved unknown settings entries

    Scenario: An accepted hook-only Claude settings file is retired completely
      Given a proven legacy project settings file is an exact released file containing only accepted Safeword hooks
      When its UserPromptSubmit event completes successfully
      Then the obsolete Claude settings file is removed instead of replaced by an empty object

    Scenario: Claude contraction never removes shared project state
      Given a proven legacy project also contains project-owned Safeword state and active Cursor and Codex delivery
      When its UserPromptSubmit event completes successfully
      Then every byte outside Claude-only legacy delivery is unchanged

    Scenario: A filesystem refusal after authorization remains non-blocking and recoverable
      Given a proven accepted legacy target cannot be replaced because the filesystem refuses the operation
      When its UserPromptSubmit event completes successfully
      Then the prompt remains successful with one advisory naming the target and retry action
      And the durable transaction records a recoverable before image without changing that target
      And restoring filesystem access lets recovery complete from that transaction

    @rejection
    Scenario: Legacy bytes never change before a durable transaction exists
      Given a cleanup-ready legacy project whose transaction path cannot store a durable record
      When its UserPromptSubmit event completes successfully
      Then every legacy byte remains unchanged and plugin mode is not written
      And the prompt continues with one recovery advisory

    @rejection
    Scenario: A symlinked legacy path cannot escape automatic contraction
      Given a catalogued legacy path is a symlink to a file outside the canonical project
      When its UserPromptSubmit event completes successfully
      Then the symlink and external file remain byte-for-byte unchanged
      And no cleanup transaction includes that path
      And the prompt continues with one advisory naming the unsafe path and repair action

    @rejection
    Scenario: An uncatalogued legacy release is preserved instead of guessed safe to delete
      Given a proven legacy project contains only managed-path bytes from an uncatalogued release
      When its UserPromptSubmit event completes successfully
      Then every uncatalogued byte remains unchanged
      And the prompt continues with one plain-language advisory naming the preserved paths
      And plugin mode records the unresolved paths and current catalogue digest
      And another prompt does not launch migration until the catalogue digest changes

    Scenario: A proven fresh project without legacy assets converges directly to plugin mode
      Given the exact current plugin has handled a prompt in a project with no legacy Claude delivery
      When automatic migration observes the repository
      Then a durable plugin-mode marker is written with no conflict or cleanup action

  @automatic-claude-migration.NTB1.R2 @surface.claude-code
  Rule: automatic-claude-migration.NTB1.R2 — Missing or failed plugin proof leaves legacy delivery unchanged and names one understandable next action

    @rejection
    Scenario: An unproven plugin preserves all legacy delivery
      Given a legacy Claude project has an enabled plugin without current execution proof
      When automatic migration observes the repository
      Then every project byte is unchanged
      And the prompt continues with reload as the sole next action

    @rejection
    Scenario Outline: Mismatched execution proof cannot authorize migration
      Given a legacy Claude project has a <proof-defect> execution proof
      When automatic migration observes the repository
      Then every project byte is unchanged
      And the prompt continues with reload as the sole next action

      Examples:
        | proof-defect              |
        | different-repository      |
        | previous-plugin-version   |
        | wrong-event               |
        | different-plugin-identity |

    @rejection
    Scenario: A failed plugin event cannot authorize contraction
      Given a legacy Claude project whose final plugin UserPromptSubmit sibling fails
      When the failed event finishes
      Then no execution proof or migration transaction is written
      And every legacy file, settings entry, and plugin-mode marker equals its pre-event image
      And the prompt continues with one action to repair or retry the reported plugin error

  @automatic-claude-migration.TBU1.R1 @surface.claude-code @surface.safeword-cli
  Rule: automatic-claude-migration.TBU1.R1 — Competing migrations have one durable winner and recovery accepts recorded before or after images while refusing a third image

    Scenario: Concurrent automatic migrations converge through one exclusive transaction
      Given two plugin processes observe the same cleanup-ready repository
      When a barrier releases both automatic contraction attempts against the absent transaction
      Then the racing prompts expose one winning transaction without conflicting mutations
      And the next prompt completes that same winning transaction

    Scenario: A race loser defers when the transaction winner exceeds its wait budget
      Given two plugin processes race and the transaction winner remains active beyond the loser's bounded wait
      When the losing automatic contraction attempt reaches its deadline
      Then it creates no second transaction and keeps the prompt successful with one retry advisory
      And the next successful prompt enters plugin mode without creating another transaction

    Scenario Outline: Recovery completes every recorded idempotent transaction image
      Given an interrupted migration contains <entry-state> target images
      When automatic recovery runs
      Then every target contains its recorded after image
      And the completed transaction is removed
      And the project enters plugin mode without losing unrelated bytes

      Examples:
        | entry-state        |
        | all before         |
        | mixed before/after |
        | all after          |

    Scenario: A timed-out automatic migration defers safely to the next prompt
      Given an automatic migration is interrupted after its durable transaction is written
      When the outer migration deadline expires
      Then the current prompt remains successful with one retry advisory
      And the next successful prompt completes the recorded transaction and enters plugin mode

    Scenario: A later session can recover after spending its normal launch
      Given a later Claude session has spent its normal launch and a durable transaction remains
      When another prompt succeeds in that later session
      Then its dedicated recovery launch completes the transaction and enters plugin mode

    Scenario: Repeated automatic attempts do not run migration on every prompt forever
      Given automatic migration has recorded three calls in one Claude session
      When another prompt succeeds in that session
      Then no automatic migration call runs and one explicit repair action is advised
      And the first successful prompt in a new session permits one automatic recovery attempt

    @rejection
    Scenario: Recovery preserves a concurrently edited third image
      Given an interrupted migration target differs from both recorded images
      When automatic recovery runs
      Then the concurrent bytes and durable recovery evidence remain unchanged
      And the prompt continues with one recovery-conflict advisory

    @rejection
    Scenario Outline: Recovery rejects hostile or corrupted transaction targets
      Given an interrupted migration transaction has a <transaction-defect>
      When automatic recovery runs
      Then no project or external byte changes and the transaction remains

      Examples:
        | transaction-defect       |
        | absolute target          |
        | parent traversal         |
        | malformed before digest |
        | post-claim symlink       |

    @rejection
    Scenario: Contraction preserves a target replaced after its transaction is claimed
      Given a cleanup-ready target changes after the durable transaction claim
      When automatic migration runs against the changed target
      Then the changed bytes remain and the recoverable transaction records the original preimage

  @automatic-claude-migration.SWM1.R1 @surface.claude-code @surface.safeword-cli
  Rule: automatic-claude-migration.SWM1.R1 — Project enrollment survives contraction, identical scope overlap resolves to one effective plugin, and incompatible overlap remains visible

    Scenario: Project-scoped enrollment survives contraction for the next teammate
      Given a cleanup-ready project declares the exact marketplace and plugin at project scope
      When automatic contraction completes
      Then the exact project-scoped declaration and unrelated settings remain byte-for-byte intact
      And no legacy asset remains alongside the preserved project declaration

    Scenario: Identical project and user declarations resolve to one effective plugin
      Given the exact plugin is declared at both project and user scope
      When Safeword observes and dispatches it for the repository
      Then status reports one healthy effective project installation
      And one prompt timestamp context block is emitted

    @rejection
    Scenario: Incompatible applicable declarations remain visible without contraction
      Given project and user scopes resolve to incompatible Safeword plugin identities
      When automatic migration observes the repository
      Then legacy delivery and both declarations remain unchanged
      And the prompt continues with one scope-conflict advisory
      And unchanged declarations suppress another migration launch in that session
      And a new session permits one re-evaluation

  @automatic-claude-migration.SWM1.R2 @surface.safeword-cli
  Rule: automatic-claude-migration.SWM1.R2 — Every supported historical fingerprint and generated migration entrypoint is release-checked against real artifacts

    Scenario: Release validation accepts a complete historical catalogue and wired migration entrypoint
      Given every supported pre-plugin fixture is catalogued and the generated dispatcher reaches automatic migration
      When the Claude migration release contract runs
      Then validation passes with every fixture path and runtime entrypoint accounted for

    @rejection
    Scenario: Release validation rejects a historical fixture absent from the ownership catalogue
      Given a supported pre-plugin release fixture contains an uncatalogued managed Claude asset
      When the Claude migration release contract runs
      Then validation fails naming the release, path, and missing fingerprint

    @rejection
    Scenario: Release validation rejects stale or extra catalogue content
      Given the committed historical catalogue contains content absent from the independent release fixtures
      When the Claude migration release contract runs
      Then validation fails naming catalogue drift and the regeneration action

    @rejection
    Scenario Outline: Release validation rejects malformed catalogue invariants
      Given the committed historical catalogue has a <catalogue-defect>
      When the Claude migration release contract runs
      Then validation fails naming catalogue drift and the regeneration action

      Examples:
        | catalogue-defect       |
        | duplicate path         |
        | ambiguous fingerprint  |
        | malformed digest       |
        | nondeterministic order |
        | escaped managed path   |

    @rejection
    Scenario: Generated plugin validation rejects an unwired automatic migration entrypoint
      Given the canonical dispatcher can migrate but the generated plugin cannot reach that behavior
      When the automatic Claude migration release catalogue is validated
      Then validation fails naming the missing runtime dependency or wiring proof

    @rejection
    Scenario: Release validation rejects a stale generated plugin bundle
      Given the generated Claude plugin predates the current historical catalogue
      When the Claude plugin release contract validates that generated bundle
      Then validation fails naming the stale generated runtime and regeneration action

    Scenario: Release validation is independent of the caller's test environment
      Given every supported pre-plugin fixture is catalogued and the generated dispatcher reaches automatic migration
      When the Claude plugin release contract runs from a test environment
      Then the generated plugin remains aligned with canonical sources

  @automatic-claude-migration.SWM1.R3 @surface.claude-code @surface.safeword-cli
  Rule: automatic-claude-migration.SWM1.R3 — Automatic contraction never mutates the safeword dev repository itself

    @rejection
    Scenario: The safeword dev repo's own legacy delivery survives automatic contraction
      Given a proven legacy project is the safeword dev repository itself
      When its UserPromptSubmit event completes successfully
      Then every project byte is unchanged
      And no execution proof or migration transaction is written
