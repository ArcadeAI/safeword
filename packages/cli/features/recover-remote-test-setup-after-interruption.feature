@wip
Feature: Recover remote-test setup after interruption

  @recover-remote-test-setup-after-interruption.H136BP.R1 @surface.safeword-cli
  Rule: recover-remote-test-setup-after-interruption.H136BP.R1 — An interrupted command leaves a complete old or new workflow and an explicit retry remains safe

    @rejection
    Scenario Outline: Setup failures expose only a complete destination
      Given the destination is <initial> with preference <preference>
      And the harness records any private path selected by this invocation
      And the filesystem adapter will return <failure>
      When `safeword project test-execution remote setup` runs
      Then the command exits 2 with <failure_result>
      And the destination is <allowed>
      And preference remains <preference>
      Examples:
        | initial | preference | failure | failure_result | allowed |
        | absence | `local` | temporary-file creation failure | the creation operation failure | absent with no invocation-owned temporary file |
        | absence | `local` | temporary-file write failure | the write operation failure | absent with no invocation-owned temporary file |
        | a historical workflow | `remote-preferred` | temporary-file sync failure | the sync operation failure | the historical workflow with no invocation-owned temporary file |
        | a historical workflow | `remote-preferred` | destination recheck operation failure | the recheck operation failure | the historical workflow with no invocation-owned temporary file |
        | a historical workflow | `remote-preferred` | atomic rename failure | the rename operation failure | the historical workflow with no invocation-owned temporary file |
        | a historical workflow | `remote-preferred` | final destination verification failure | the verification operation failure | the complete current bundled workflow with no invocation-owned temporary file |

    @rejection
    Scenario: Temporary-file cleanup failure does not hide the primary setup failure
      Given setup starts from a historical workflow with preference `remote-preferred`
      And the harness records the private path selected by this invocation
      And temporary-file write and subsequent removal of the invocation's private file will fail
      When `safeword project test-execution remote setup` runs
      Then the command exits 2 with the write failure as primary and cleanup failure as secondary
      And the destination remains the historical workflow
      And the recorded private path contains a non-empty strict prefix of the bundled workflow bytes
      And the recorded private path is inside the destination workflow directory
      And preference remains `remote-preferred`

    Scenario: A retry ignores a private file left by failed cleanup
      Given a historical workflow and a private file left by a prior failed cleanup
      And the deterministic test adapter selects a different fresh private path
      When `safeword project test-execution remote setup` runs again
      Then the command exits 0 and the destination becomes the current bundled workflow
      And the leftover file remains byte-identical
      And the successful invocation leaves no temporary file of its own

    @rejection
    Scenario Outline: Disable reports failure without claiming the wrong destination state
      Given the destination is the current bundled workflow with preference <preference>
      And <operation> will fail
      When `safeword project test-execution remote disable` runs
      Then the command exits 2 with <failure_result>
      And the destination is <allowed> and preference is unchanged
      Examples:
        | preference | operation | failure_result | allowed |
        | `local` | destination removal | the removal operation failure | the complete current workflow |
        | `remote-preferred` | final absence verification | the verification operation failure | absent |

    @rejection
    Scenario Outline: A successful ownership recheck detects a late customer change
      Given <command> initially classifies <initial>
      And customer bytes replace the destination at the deterministic pre-mutation barrier
      And the harness records any private path selected by this invocation
      When <command> continues
      Then the command exits 2 with `move_aside_and_repeat`, preserves the customer bytes, and does not publish or remove them
      And the private-path recorder reports <private_path_result>
      And preference remains `remote-preferred`
      Examples:
        | command | initial | private_path_result |
        | `safeword project test-execution remote setup` | a historical workflow | its selected file was removed |
        | `safeword project test-execution remote disable` | the current bundled workflow | no selection |

    Scenario: A non-cooperating write after the recheck follows filesystem ordering
      Given setup has successfully rechecked a historical workflow
      And customer bytes replace the destination after that recheck but before rename
      When setup continues through exactly one atomic rename
      Then the command exits 0 and the destination equals the complete current bundled byte sequence
      And the harness observed the customer bytes immediately before rename
      And the adapter recorded exactly one rename onto the destination

    Scenario: Interruption immediately before rename preserves exact historical bytes
      Given setup starts from the exact historical workflow bytes
      When the harness fires the interruption exactly once immediately before atomic rename
      Then the destination equals the complete historical byte sequence
      And the harness records the barrier once and abnormal termination before normal completion

    Scenario: Interruption immediately after rename preserves exact current bytes
      Given setup starts from the exact historical workflow bytes
      When the harness fires the interruption exactly once immediately after atomic rename
      Then the destination equals the complete current bundled byte sequence
      And the harness records the barrier once and abnormal termination before normal completion

    Scenario Outline: Disable interruption exposes only a complete workflow or absence
      Given disable starts from the exact current bundled workflow bytes
      When the harness fires the interruption exactly once <boundary> destination removal
      Then the destination is <result>
      And the harness records the barrier once and abnormal termination before normal completion
      Examples:
        | boundary | result |
        | immediately before | the complete current bundled workflow |
        | immediately after | absent |

    Scenario Outline: Explicit retry converges from representative admitted states
      Given an interrupted command leaves <state> and <leftover>
      And the deterministic test adapter selects a different fresh private path and records it
      When the builder explicitly repeats <command>
      Then the destination becomes <target>, the leftover remains byte-identical, and the command exits 0
      And the successful invocation leaves no temporary file of its own
      And the adapter records <operation_count>
      Examples:
        | state | leftover | command | target | operation_count |
        | absence | a partial private file from an invocation interrupted mid-write | `safeword project test-execution remote setup` | the current bundled workflow | one destination rename |
        | a supported historical workflow | a complete synced private file from the interrupted invocation | `safeword project test-execution remote setup` | the current bundled workflow | one destination rename |
        | the current bundled workflow | one unrelated temporary-looking file | `safeword project test-execution remote setup` | the current bundled workflow | zero destination renames |
        | a supported historical workflow | one unrelated temporary-looking file | `safeword project test-execution remote disable` | absence | one destination removal |
        | absence | one unrelated temporary-looking file | `safeword project test-execution remote disable` | absence | zero destination removals |

    @rejection
    Scenario Outline: Explicit retry preserves a customer-owned destination
      Given an interrupted command left the destination untouched, then a customer wrote workflow bytes with preference `local`
      And the harness records any private path selected by this invocation
      When the builder explicitly repeats <command>
      Then the command exits 2 with `move_aside_and_repeat`
      And the customer-owned workflow remains byte-identical
      And the private-path recorder reports <private_path_result>
      And preference remains `local`
      Examples:
        | command | private_path_result |
        | `safeword project test-execution remote setup` | no selection |
        | `safeword project test-execution remote disable` | no selection |

    @rejection
    Scenario Outline: Setup refuses a symlink occupying its selected private path
      Given the destination is a historical workflow with preference `remote-preferred`
      And the deterministic test adapter selects a fresh private path occupied by <symlink>
      And the harness snapshots the object and any resolved target
      When `safeword project test-execution remote setup` runs
      Then the command exits 2 with an operation-failed result
      And the historical workflow remains byte-identical
      And the object remains type- and content-identical where content applies
      And the symbolic-link target remains <target_state>
      And the filesystem adapter records no operation through the occupied object
      And preference remains `remote-preferred`
      Examples:
        | symlink | target_state |
        | a symbolic link resolving outside the repository | byte-identical |
        | a dangling symbolic link resolving outside the repository | absent |

    Scenario Outline: Later invocations ignore representative temporary-looking objects
      Given the destination is absent
      And the workflow directory contains <object> resembling a setup temporary name from another invocation
      And the deterministic test adapter selects a different fresh private path
      And the harness snapshots the object and any resolved target
      When `safeword project test-execution remote setup` runs
      Then the command exits 0 and installs the current bundled workflow
      And the object remains type- and content-identical where content applies
      And any symbolic-link target remains byte-identical as initially observed
      And the filesystem adapter records no operation through <object>
      Examples:
        | object |
        | an unknown regular file |
        | a symbolic link outside the workflow directory |
