@architecture-state-docs
Feature: Always-fresh point-in-time architecture doc (Slice 1, single-repo)

  The architecture state doc (.project/architecture.generated.md) describes the system as
  it is now. Its structural facts are extracted deterministically and self-heal
  at session start; any prose that has fallen behind the structure is visibly
  flagged, so the doc may be incomplete but is never silently wrong.

  Rule: The skeleton reflects the real project

    @architecture-state-docs.NTB1.AC1
    Scenario: The listed modules equal the real tree, with resolving references
      Given a project whose src/ contains exactly the modules auth and billing
      When the architecture doc is generated
      Then the doc lists exactly auth and billing, with no others
      And each module's reference points to its real path (src/auth, src/billing)

    @architecture-state-docs.NTB1.AC1
    Scenario: Every skeleton node carries a non-empty purpose
      Given a single-repo TypeScript project
      When the architecture doc is generated
      Then every skeleton node has a non-empty one-line purpose

    @architecture-state-docs.NTB1.AC1
    Scenario: A file outside any module is not listed as a node
      Given a project with a stray script at scripts/build.ts outside src/
      When the architecture doc is generated
      Then scripts/build.ts does not appear as a skeleton node

    @architecture-state-docs.NTB1.AC1
    Scenario: A project with no modules produces no doc, without error
      Given a project that has no src directory
      When the architecture doc is generated
      Then no architecture doc is written

    @architecture-state-docs.NTB1.AC1
    Scenario: An empty src directory produces no doc, without error
      Given a project whose src/ exists but contains no modules
      When the architecture doc is generated
      Then no architecture doc is written

    @architecture-state-docs.NTB1.AC1
    Scenario: Extraction is content-agnostic — a malformed file never aborts it
      Given a project with a module containing a malformed source file
      When the architecture doc is generated
      Then the module is still listed in the skeleton

  Rule: Stale prose is visibly flagged, never silently wrong

    @architecture-state-docs.NTB1.AC2
    Scenario: Prose reconciled with the current structure shows no marker
      Given a doc whose prose section is stamped with the current skeleton fingerprint
      When the doc is reconciled
      Then that prose section carries no staleness marker

    @architecture-state-docs.NTB1.AC2
    Scenario: Prose that has fallen behind the structure is marked stale
      Given a doc whose prose section describes a node that still exists
      And that section is stamped with an older skeleton fingerprint
      When the doc is reconciled
      Then that prose section is marked stale

    @architecture-state-docs.NTB1.AC2
    Scenario: A section describing a removed node is flagged orphaned, not merely stale
      Given a doc with a drifted-stamp prose section describing a module that no longer exists
      When the doc is reconciled
      Then that prose section is flagged as orphaned
      And it is not labelled merely stale

    @architecture-state-docs.NTB1.AC2
    Scenario: A newly added node gets a purpose placeholder and is not marked stale
      Given a project with a module that has no prose in the doc yet
      When the doc is reconciled
      Then the new node is emitted with a purpose placeholder awaiting prose
      And the new node is not marked stale

  Rule: Structural facts self-heal at session start

    @architecture-state-docs.TB1.AC1
    Scenario: A moved fingerprint heals the doc to the current shape
      Given a doc whose recorded fingerprint differs from the project's current shape
      When a session starts
      Then the doc's skeleton matches the current shape
      And the recorded fingerprint equals the current shape's fingerprint

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

    @architecture-state-docs.TB1.AC1
    Scenario: A doc with a missing or corrupt fingerprint is regenerated, never left unreconciled
      Given a doc whose frontmatter fingerprint is missing or corrupt
      When a session starts
      Then the skeleton is regenerated from the current structure
      And the doc is not left silently unreconciled

  Rule: The fingerprint captures shape, not noise

    @architecture-state-docs.TB1.AC2
    Scenario Outline: The fingerprint changes only for structural change
      Given a doc whose fingerprint matches the project's current shape
      When the project changes by <change>
      Then the fingerprint <result>

      Examples:
        | change                                      | result                                  |
        | adding a top-level module                   | differs from the recorded fingerprint   |
        | adding a dependency                         | differs from the recorded fingerprint   |
        | changing a dependency-cruiser boundary rule | differs from the recorded fingerprint   |
        | adding a schema file                        | differs from the recorded fingerprint   |
        | bumping only a dependency version           | is unchanged from the recorded fingerprint |
        | editing only a comment in a source file     | is unchanged from the recorded fingerprint |

    @architecture-state-docs.TB1.AC2
    Scenario: An out-of-band change is healed and its lagging prose flagged at session start
      Given a structural change was committed with no agent in the loop
      When a session starts
      Then the skeleton is re-synced to the change
      And any prose left behind by the change is flagged
