@architecture-state-docs
Feature: Always-fresh point-in-time architecture doc (Slice 1, single-repo)

  The architecture state doc (.project/architecture.md) describes the system as
  it is now. Its structural facts are extracted deterministically and self-heal
  at session start; any prose that has fallen behind the structure is visibly
  flagged, so the doc may be incomplete but is never silently wrong.

  Rule: The skeleton reflects the real project

    @architecture-state-docs.NTB1.AC1
    Scenario: Each top-level module appears with a code reference
      Given a single-repo TypeScript project with modules under src/
      When the architecture doc is generated
      Then every top-level module is listed with a reference to its location

    @architecture-state-docs.NTB1.AC1
    Scenario: Every skeleton node carries a one-line purpose
      Given a single-repo TypeScript project
      When the architecture doc is generated
      Then every skeleton node has a one-line purpose

    @architecture-state-docs.NTB1.AC1
    Scenario: A non-structural file is not listed as a node
      Given a project containing a loose script that is not part of any module
      When the architecture doc is generated
      Then that file does not appear as a skeleton node

    @architecture-state-docs.NTB1.AC1
    Scenario: A project with no src directory still produces a doc
      Given a project that has no src directory
      When the architecture doc is generated
      Then a minimal skeleton is produced without error

    @architecture-state-docs.NTB1.AC1
    Scenario: An unparseable source file does not abort extraction
      Given a project with one source file that cannot be parsed
      When the architecture doc is generated
      Then the unparseable file is recorded as skipped
      And the rest of the skeleton is still produced

  Rule: Stale prose is visibly flagged, never silently wrong

    @architecture-state-docs.NTB1.AC2
    Scenario: Prose reconciled with the current structure shows no marker
      Given a doc whose prose section is stamped with the current skeleton fingerprint
      When the doc is reconciled
      Then that prose section carries no staleness marker

    @architecture-state-docs.NTB1.AC2
    Scenario: Prose that has fallen behind the structure is marked stale
      Given a doc whose prose section is stamped with an older skeleton fingerprint
      When the doc is reconciled
      Then that prose section is marked stale

    @architecture-state-docs.NTB1.AC2
    Scenario: Prose describing a removed node is flagged as orphaned
      Given a doc with a prose section describing a module that no longer exists
      When the doc is reconciled
      Then that prose section is flagged as orphaned

    @architecture-state-docs.NTB1.AC2
    Scenario: A newly added node requires a purpose but is not marked stale
      Given a project with a module that has no prose in the doc yet
      When the doc is reconciled
      Then the new node requires a one-line purpose
      And the new node is not marked stale

  Rule: Structural facts self-heal at session start

    @architecture-state-docs.TB1.AC1
    Scenario: A moved fingerprint triggers re-extraction at session start
      Given a doc whose recorded fingerprint differs from the project's current shape
      When a session starts
      Then the skeleton is re-extracted to match the current shape

    @architecture-state-docs.TB1.AC1
    Scenario: An unchanged fingerprint leaves the doc untouched
      Given a doc whose recorded fingerprint matches the project's current shape
      When a session starts
      Then the doc is left unchanged

    @architecture-state-docs.TB1.AC1
    Scenario: A project with no architecture doc gets one created
      Given a project that has no architecture doc
      When a session starts
      Then an architecture doc is created from the current structure

  Rule: The fingerprint captures shape, not noise

    @architecture-state-docs.TB1.AC2
    Scenario Outline: The fingerprint moves only for structural change
      Given a doc whose fingerprint matches the project's current shape
      When the project changes by <change>
      Then the fingerprint <result>

      Examples:
        | change                                  | result        |
        | adding a top-level module               | moves         |
        | adding a dependency                     | moves         |
        | changing a dependency-cruiser boundary rule | moves     |
        | adding a schema file                    | moves         |
        | bumping only a dependency version       | does not move |
        | editing only a comment in a source file | does not move |

    @architecture-state-docs.TB1.AC2
    Scenario: An out-of-band structural change is detected at the next session start
      Given a structural change was committed with no agent in the loop
      When a session starts
      Then the change is detected as drift from the recorded fingerprint
