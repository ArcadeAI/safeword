Feature: Manage remote-test workflows without overwriting customers

  @manage-remote-test-workflows-without-overwriting-customers.TBU1.R1 @surface.safeword-cli
  Rule: manage-remote-test-workflows-without-overwriting-customers.TBU1.R1 — Customer workflow bytes observed before mutation are never changed

    Scenario Outline: Status classifies representative ownership states
      Given the remote-test workflow is <fixture>
      And the builder snapshots repository entries, Safeword state, and execution preference
      When the builder requests JSON `safeword project test-execution remote status`
      Then it exits 0 with <state>, affected path <path>, and next action <action>
      And it changes no repository entry, Safeword state, or execution preference
      Examples:
        | fixture | state | path | action |
        | the exact bundled workflow with CRLF line endings | `current` | `null` | `null` |
        | the bundled workflow with one customer edit | `customer_owned` | `.github/workflows/safeword-remote-tests.yml` | `move_aside_and_repeat` |
        | installed under a symlinked `.github` whose target contains the exact bundled workflow | `unsafe_path` | `.github` | `repair_path_and_repeat` |

    @rejection
    Scenario Outline: Setup preserves every path it cannot prove safe to own
      Given the workflow path contains <fixture> with preference <preference>
      And the builder snapshots repository entries, link targets, Safeword state, and execution preference
      When the builder runs `safeword project test-execution remote setup`
      Then it exits 2 with <state>, affected path <path>, <action>, and `REMOTE_WORKFLOW_CONFLICT`
      And human output includes <sentence>
      And the snapshot, Safeword state, and execution preference remain identical
      Examples:
        | fixture | preference | state | path | action | sentence |
        | customer-created bytes | `local` | `customer_owned` | `.github/workflows/safeword-remote-tests.yml` | `move_aside_and_repeat` | “Safeword won't overwrite the differing workflow. Compare or move it aside, then run the command again.” |
        | a destination symlink targeting an in-repository directory | `remote-preferred` | `unsafe_path` | `.github/workflows/safeword-remote-tests.yml` | `repair_path_and_repeat` | “Repair the workflow path, then run the command again.” |

    Scenario Outline: Setup publishes a complete workflow without selecting remote execution
      Given the workflow and both managed parent directories are absent with preference <preference>
      And the builder snapshots repository entries, Safeword state, and execution preference
      When the builder runs `safeword project test-execution remote setup`
      Then it exits 0 with `current`, affected path `null`, next action `null`, and installs the exact bundled workflow
      And `.github` and `.github/workflows` are real directories
      And no pre-existing repository entry, Safeword state, or execution preference changes
      And output reports effective mode <mode>, unchanged preference, and <guidance>
      Examples:
        | preference | mode | guidance |
        | `local` | `local` | “Run `safeword project test --execution remote-preferred` to prefer remote execution.” |
        | `remote-preferred` | `remote-preferred` | “Remote-preferred execution is already selected.” |

    @rejection
    Scenario: Invalid execution configuration prevents setup before mutation
      Given the workflow is absent and test-execution configuration is invalid
      And the builder snapshots repository entries and Safeword state
      When the builder runs `safeword project test-execution remote setup`
      Then it exits 2 with non-retryable `SAFEWORD_TEST_EXECUTION_INVALID` and no lifecycle data
      And the snapshot remains identical

    @rejection
    Scenario: A concurrently appearing customer workflow is never replaced
      Given setup has prepared and synced the complete private workflow
      And customer bytes appear at the destination before publication
      And the injected filesystem records publication attempts
      When setup attempts exclusive publication
      Then it exits 2 with `customer_owned`, affected path `.github/workflows/safeword-remote-tests.yml`, `move_aside_and_repeat`, and `REMOTE_WORKFLOW_CONFLICT`
      And the customer bytes remain identical and no second publication is attempted
      And setup removes only the private entry created by this invocation

    Scenario Outline: Exclusive publication reclassification is bounded
      Given setup's exclusive publication reports EEXIST
      And the injected filesystem records publication attempts
      And the builder snapshots Safeword state and execution preference
      When its single reclassification reports <state>
      Then setup produces <outcome> without another publication attempt
      And Safeword state and execution preference remain identical
      Examples:
        | state | outcome |
        | `current` | exit 0 with `current`, unchanged destination bytes, and no private residue |
        | `unsafe_path` | exit 2 with `unsafe_path`, affected path `.github/workflows/safeword-remote-tests.yml`, `REMOTE_WORKFLOW_CONFLICT`, unchanged destination entry, and no private residue |
        | `not_installed` | exit 2 with result-envelope state `failed`, retryable `REMOTE_WORKFLOW_RETRY`, no lifecycle data, and no private residue |
        | an indeterminate observation | exit 2 with result-envelope state `failed`, retryable `REMOTE_WORKFLOW_RETRY`, no lifecycle data, and no private residue |

    Scenario Outline: Interrupted publication never exposes a partial workflow
      Given private names are recorded against the directory state before each invocation
      And the builder snapshots Safeword state and execution preference
      When setup is interrupted after <boundary>
      Then the destination is <destination>
      And private residue is <residue>
      And every private entry is in the workflow directory and absent from its pre-invocation state
      And every private name is dot-prefixed without a `.yml` or `.yaml` suffix
      And Safeword state and execution preference remain identical
      Examples:
        | boundary | destination | residue |
        | private create | absent | present |
        | private write | absent | present |
        | private sync | absent | present |
        | exclusive link | the complete bundled workflow | present |
        | private cleanup | the complete bundled workflow | absent |

    @rejection
    Scenario: Setup reports unsupported exclusive publication plainly
      Given safe real workflow parents exist, the workflow is absent, and preference is `local`
      And exclusive same-directory linking is unsupported at this path
      And the builder snapshots repository entries, Safeword state, and execution preference
      When the builder runs `safeword project test-execution remote setup`
      Then it exits 2 with result-envelope state `failed`, non-retryable `REMOTE_WORKFLOW_PUBLICATION_FAILED`, and no lifecycle data
      And it says “Safeword could not publish the workflow. Fix the reported permission, capacity, or filesystem-support problem; local testing remains available.”
      And the destination remains absent and the snapshot remains identical

    @rejection
    Scenario: Setup reports an unwritable safe workflow directory plainly
      Given safe real workflow parents exist and classify the absent workflow as `not_installed`
      And creating the private file reports EACCES
      When the builder runs `safeword project test-execution remote setup`
      Then it exits 2 with non-retryable `REMOTE_WORKFLOW_PUBLICATION_FAILED` and no lifecycle data
      And it reports operation `create` and code `EACCES`
      And the destination remains absent

    Scenario: Cleanup failure does not misreport a published workflow as failed
      Given setup exclusively published the complete bundled workflow
      And removing its private entry fails
      When setup completes
      Then it exits 0 with `current` and warning `REMOTE_WORKFLOW_RESIDUE`
      And it says “The workflow is installed, but Safeword could not remove temporary file <path>. GitHub Actions cannot run it; it is safe to delete.” with the actual private path
      And the complete destination and private residue remain

    Scenario: Retry after interruption ignores unknown private residue
      Given exactly one private residue remains from a setup interrupted before publication
      And the destination is absent
      When the builder repeats `safeword project test-execution remote setup`
      Then it exits 0 and installs the complete bundled workflow
      And the prior residue is in the workflow directory with a dot-prefixed name lacking a `.yml` or `.yaml` suffix
      And the retry uses a distinct private name
      And the prior residue remains identical and the new invocation leaves no residue

    @rejection
    Scenario: Setup rejects an unsafe parent that wins a creation race
      Given `.github/workflows` is absent when setup begins creating managed parents
      And a symlink appears there before mkdir reports EEXIST
      And the injected filesystem records mkdir and inspection attempts
      When setup reinspects that parent once without following links
      Then it exits 2 with `unsafe_path`, affected path `.github/workflows`, `repair_path_and_repeat`, and `REMOTE_WORKFLOW_CONFLICT`
      And it does not publish or follow the link
      And the operation log records one inspection and no further mkdir

    Scenario Outline: Disable removes only a workflow Safeword currently owns
      Given <workflow> exists with preference <preference>
      When the builder runs `safeword project test-execution remote disable`
      Then it exits 0 with `not_installed`, affected path `null`, next action `null`, and removes only the workflow entry
      And preference remains <preference>
      Examples:
        | workflow | preference |
        | the exact bundled workflow | `remote-preferred` |
        | the bundled workflow with CRLF line endings | `local` |

    Scenario Outline: Disable handles unlink races and failures honestly
      Given disable's final recheck reports `current`
      And unlink reports <error>
      When disable completes
      Then it produces <outcome>
      Examples:
        | error | outcome |
        | ENOENT | exit 0 with `not_installed`, affected path `null`, and next action `null` |
        | EACCES | exit 2 with `current`, the workflow path, `repair_path_and_repeat`, non-retryable `REMOTE_WORKFLOW_REMOVAL_FAILED`, and operation/code/path detail |

    Scenario Outline: Disable preserves uncertainty at its final recheck
      Given disable initially classified the exact bundled workflow
      And the final recheck observes <observation>
      And the injected filesystem records unlink attempts
      When disable continues
      Then it produces <outcome> and <entry_result>
      And the operation log records no unlink
      Examples:
        | observation | outcome | entry_result |
        | customer bytes | exit 0 with `customer_owned`, affected path `null`, and next action `null` | leaves the customer bytes identical |
        | a destination symlink | exit 2 with `unsafe_path`, affected path `.github/workflows/safeword-remote-tests.yml`, `repair_path_and_repeat`, and `REMOTE_WORKFLOW_CONFLICT` | leaves the symlink identical |
        | an indeterminate error | exit 2 with result-envelope state `failed`, retryable `REMOTE_WORKFLOW_RETRY`, and no lifecycle data | leaves the destination unchanged |
        | absence | exit 0 with `not_installed`, affected path `null`, and next action `null` | leaves the destination absent |

    @rejection
    Scenario Outline: Initial uncertainty prevents mutation
      Given <command>'s initial workflow observation returns an indeterminate error
      And the builder snapshots repository entries, Safeword state, and execution preference
      When the builder runs <command>
      Then it exits 2 with result-envelope state `failed`, retryable `REMOTE_WORKFLOW_RETRY`, and no lifecycle data
      And the snapshot remains identical
      Examples:
        | command |
        | `safeword project test-execution remote setup` |
        | `safeword project test-execution remote disable` |

    Scenario: Disable leaves a customer-owned workflow alone
      Given customer-owned workflow bytes exist
      And the builder snapshots those bytes, Safeword state, and execution preference
      When the builder runs `safeword project test-execution remote disable`
      Then it exits 0 with `customer_owned`, affected path `null`, and no next action
      And it says “No Safeword workflow is installed at this path; the existing workflow is yours and was left unchanged.”
      And the snapshot remains identical

    @rejection
    Scenario: Disable refuses an unsafe workflow path
      Given `.github/workflows` is a symbolic link resolving outside the repository
      And the builder snapshots repository entries, the resolved target, Safeword state, and execution preference
      When the builder runs `safeword project test-execution remote disable`
      Then it exits 2 with `unsafe_path`, affected path `.github/workflows`, `repair_path_and_repeat`, and `REMOTE_WORKFLOW_CONFLICT`
      And the snapshot, Safeword state, and execution preference remain identical

    Scenario Outline: Repeating a lifecycle command is a successful no-op
      Given the workflow is <state> with preference <preference>
      And the builder snapshots entries, metadata, Safeword state, and execution preference
      When the builder runs <command>
      Then it exits 0 with <result> and changes no entry, metadata, Safeword state, or execution preference
      Examples:
        | state | preference | command | result |
        | the exact bundled workflow with CRLF line endings | `local` | `safeword project test-execution remote setup` | `current` with affected path `null`, next action `null`, byte-identical CRLF destination bytes, and effective mode `local` |
        | absent | `remote-preferred` | `safeword project test-execution remote disable` | `not_installed` with affected path `null` and next action `null` |

    Scenario Outline: Human and JSON mutation results agree
      Given the remote-test workflow is <fixture>
      When the builder runs human and JSON <command>
      Then both report <result> with identical lifecycle data and exit code
      Examples:
        | fixture | command | result |
        | customer-owned | `safeword project test-execution remote setup` | exit 2 with `customer_owned`, the workflow path, and `move_aside_and_repeat` |
        | customer-owned | `safeword project test-execution remote disable` | exit 0 with `customer_owned`, affected path `null`, and next action `null` |

    Scenario Outline: Ordinary Safeword lifecycle commands remain observational
      Given the optional workflow is <fixture>
      When the builder runs <command>
      Then it exits 0, the workflow remains <fixture>, and no workflow-drift finding is reported
      And <parent_effect>
      Examples:
        | fixture | command | parent_effect |
        | absent | `safeword install` | absent managed parents remain absent |
        | the exact bundled workflow | `safeword upgrade` | existing parents remain unchanged |
        | customer-created bytes | `safeword uninstall` | existing parents remain unchanged |
        | the exact bundled workflow | `safeword uninstall` | existing parents remain unchanged |
        | absent | `safeword status` | absent managed parents remain absent |
        | customer-created bytes | `safeword doctor` | existing parents remain unchanged |

    Scenario: Uninstall explains how to remove a surviving optional workflow
      Given the exact bundled workflow exists
      When the builder runs human and JSON `safeword uninstall`
      Then both exit 0, leave the workflow identical, and report `REMOTE_WORKFLOW_REMAINS`
      And human output says “The optional remote-test workflow remains installed. Run `bunx safeword project test-execution remote disable` to remove it.”

    Scenario: Packaged disable remains usable after project uninstall
      Given project uninstall left the exact bundled workflow in place
      When the builder runs `bunx safeword project test-execution remote disable`
      Then it exits 0 with `not_installed` and removes only the workflow entry

    Scenario Outline: Remote-workflow advice never disrupts ordinary uninstall
      Given uninstall's advisory workflow observation is <observation>
      And the builder snapshots the workflow entry and any link target
      When the builder runs human and JSON `safeword uninstall`
      Then both exit 0 without `REMOTE_WORKFLOW_REMAINS`
      And the snapshot remains identical
      Examples:
        | observation |
        | `not_installed` |
        | `customer_owned` |
        | `unsafe_path` |
        | an indeterminate error |

  @manage-remote-test-workflows-without-overwriting-customers.NTB1.R1 @surface.safeword-cli
  Rule: manage-remote-test-workflows-without-overwriting-customers.NTB1.R1 — Status is read-only, stable, and gives at most one next action

    Scenario Outline: Human and JSON status agree
      Given the remote-test workflow is <fixture>
      And the builder snapshots repository entries, Safeword state, and execution preference
      When the builder requests human and JSON `safeword project test-execution remote status`
      Then both exit 0 and report <state>, affected path <path>, and next action <action>
      And JSON data contains exactly `state`, `affected_path`, and `next_action`
      And neither request changes repository, Safeword state, or execution preference
      Examples:
        | fixture | state | path | action |
        | absent | `not_installed` | `.github/workflows/safeword-remote-tests.yml` | `install_remote_tests` |
        | current | `current` | `null` | `null` |
        | customer-owned | `customer_owned` | `.github/workflows/safeword-remote-tests.yml` | `move_aside_and_repeat` |
        | blocked because `.github/workflows` is a regular file | `unsafe_path` | `.github/workflows` | `repair_path_and_repeat` |

    Scenario Outline: Human status renders the corrective action plainly
      Given the remote-test workflow is <fixture>
      When the builder requests human `safeword project test-execution remote status`
      Then output includes <sentence>
      Examples:
        | fixture | sentence |
        | absent | “Run `bunx safeword project test-execution remote setup` to install Safeword's test workflow.” |
        | customer-owned | “Safeword won't overwrite the differing workflow. Compare or move it aside, then run the command again.” |
        | blocked because `.github/workflows` is a regular file | “Repair the workflow path, then run the command again.” |

    Scenario: Human status renders current nulls explicitly
      Given the remote-test workflow is current
      When the builder requests human `safeword project test-execution remote status`
      Then affected path and next action both render as `none`

    Scenario: Repeated status is stable
      Given the remote-test workflow is customer-owned
      When the builder requests JSON `safeword project test-execution remote status` twice without changing the project
      Then both responses are byte-identical and exit 0

    @rejection
    Scenario: Indeterminate observation is read-only and plainly retryable
      Given workflow observation returns an unlisted filesystem error
      And the builder snapshots repository entries, Safeword state, and execution preference
      When the builder runs human and JSON `safeword project test-execution remote status`
      Then both exit 2 with result-envelope state `failed`, retryable `REMOTE_WORKFLOW_RETRY`, and no lifecycle data
      And human output says “Safeword could not confirm the workflow path state; run the command again.”
      And the snapshot remains identical
