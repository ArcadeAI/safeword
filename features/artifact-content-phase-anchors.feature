@artifact-content-phase-anchors
Feature: Artifact-content phase anchors — a phase advance is evidenced by the artifact it produced

  A feature ticket's forward phase advance records a `phase_anchors` entry
  whose value is the repo-relative path of the exit artifact of the phase
  being left. Detection and boundary verification read the tree alone: the
  anchored artifact must exist and pass its kind's shape check. No phase-anchor
  check consults git history, so verdicts are identical after amend, rebase,
  squash-merge, or in a shallow clone — the failure modes that orphaned the
  previous commit-SHA anchors. Hex-shaped legacy anchors are grandfathered at
  rest. The R/G/R ledger's per-tick commit SHAs are a separate mechanism and
  keep their history-backed validation unchanged. Supersedes
  evidence-anchored-phase-transitions.feature (#809's SHA grammar).

  Rule: A forward advance anchors the entered phase to the exited phase's artifact

    @artifact-content-phase-anchors.SM1.R1
    Scenario: Forward advance recording the exited phase's artifact path is anchored
      Given a feature ticket at phase scenario-gate whose impl-plan artifact exists and is shape-valid
      When it advances to implement recording that artifact's path for implement
      Then the advance is recognized as anchored

    @artifact-content-phase-anchors.SM1.R1
    Scenario: Only the entered phase needs an anchor on a multi-step advance
      Given a feature ticket at phase define-behavior whose ledger artifact exists
      When it advances two steps to implement recording an artifact path for implement only
      Then the advance is recognized as anchored

    @artifact-content-phase-anchors.SM1.R1
    Scenario: Re-advancing a phase is judged by its latest anchor entry
      Given a feature ticket that entered implement once, moved back, and re-entered implement
      When its phase_anchors block carries two implement entries and only the last names an existing artifact
      Then the advance is recognized as anchored

  Rule: An anchored advance verifies from the tree alone, under any history

    @artifact-content-phase-anchors.SM1.R2
    Scenario: Verification consults only the supplied tree, never git history
      Given a feature ticket whose anchored artifact is readable in the tree
      When the advance is checked with no git history available at all
      Then the advance is recognized as anchored

    @artifact-content-phase-anchors.SM1.R2
    Scenario: A squash-merged branch's ticket still verifies at the next boundary
      Given a project whose ticket advanced phases across several commits that were then squash-merged into one
      When a further advance on that ticket reaches the push boundary
      Then the anchor check passes without consulting the vanished commits

    @artifact-content-phase-anchors.SM1.R2
    Scenario: A shallow clone verifies anchors identically to a full clone
      Given a shallow single-depth clone of a project with an anchored feature ticket in the outgoing range
      When the boundary command runs at the push boundary
      Then the anchor check passes with no unreachable-history hedging

  Rule: A forward advance without a real artifact behind it is detectable as unanchored

    @artifact-content-phase-anchors.SM1.R3
    Scenario: Forward advance with no phase_anchors block at all is flagged with the exact line to add
      Given a feature ticket at phase scenario-gate
      When it advances to implement with no phase_anchors block recorded
      Then the advance is flagged as unanchored
      And the finding names the expected anchor line for implement

    @artifact-content-phase-anchors.SM1.R3
    Scenario: Forward advance whose phase_anchors block names only an earlier phase is flagged
      Given a feature ticket at phase scenario-gate
      When it advances to implement with a phase_anchors block naming only scenario-gate
      Then the advance is flagged as unanchored

    @artifact-content-phase-anchors.SM1.R3
    Scenario: Forward advance whose anchor value is empty is flagged
      Given a feature ticket at phase scenario-gate
      When it advances to implement recording an empty anchor value for implement
      Then the advance is flagged as unanchored

    @artifact-content-phase-anchors.SM1.R3
    Scenario Outline: Forward advance whose anchor is not a plausible repo-relative path is flagged
      Given a feature ticket at phase scenario-gate
      When it advances to implement recording "<value>" as the anchor for implement
      Then the advance is flagged as unanchored

      Examples:
        | value                     |
        | ../outside/impl-plan.md   |
        | /absolute/impl-plan.md    |

    @artifact-content-phase-anchors.SM1.R3
    Scenario: Forward advance anchored to a path absent from the tree is flagged
      Given a feature ticket at phase scenario-gate whose anchored path does not exist in the tree
      When it advances to implement recording that path for implement
      Then the advance is flagged as unanchored

    @artifact-content-phase-anchors.SM1.R3
    Scenario: Forward advance anchored to a hollow scaffold artifact is flagged
      Given a feature ticket at phase scenario-gate whose impl-plan artifact exists but fails its shape check
      When it advances to implement recording that artifact's path for implement
      Then the advance is flagged as unanchored

    @artifact-content-phase-anchors.SM1.R3
    Scenario: Forward advance anchored to the wrong kind of artifact for the phase is flagged
      Given a feature ticket at phase verify with an existing README file in the tree
      When it advances to done recording the README path as the anchor for done
      Then the advance is flagged as unanchored

    @artifact-content-phase-anchors.SM1.R3
    Scenario: A backward phase move is not flagged
      Given a feature ticket at phase implement
      When it moves back to define-behavior with no anchor
      Then the advance is not flagged

    @artifact-content-phase-anchors.SM1.R3
    Scenario: Re-declaring the same phase is not flagged
      Given a feature ticket at phase implement
      When it is re-saved at phase implement with no new anchor
      Then the advance is not flagged

    @artifact-content-phase-anchors.SM1.R3
    Scenario Outline: A non-feature ticket advancing is not flagged
      Given a <type> ticket at phase define-behavior
      When it advances to implement with no anchor
      Then the advance is not flagged

      Examples:
        | type  |
        | task  |
        | patch |
        | epic  |
        | none  |

    @artifact-content-phase-anchors.SM1.R3
    Scenario: A ticket becoming a feature past intake is not flagged
      Given a task ticket at phase implement with no anchors recorded
      When its type is changed to feature without changing the phase
      Then the advance is not flagged

    @artifact-content-phase-anchors.SM1.R3
    Scenario: An edit that leaves the phase unchanged is not flagged
      Given a feature ticket at phase implement with no anchors recorded
      When its body is edited without changing the phase
      Then the advance is not flagged

  Rule: Legacy SHA anchors neither warn at rest nor block new work

    @artifact-content-phase-anchors.SM1.R4
    Scenario: A hex-shaped legacy anchor on a ticket at rest stays silent
      Given a feature ticket at phase implement whose implement anchor is a hex-shaped commit SHA
      When its body is edited without changing the phase
      Then the advance is not flagged

    @artifact-content-phase-anchors.SM1.R4
    Scenario: A new forward advance recording a hex-shaped anchor draws the migration remediation
      Given a feature ticket at phase scenario-gate
      When it advances to implement recording a hex-shaped commit SHA as the anchor for implement
      Then the advance is flagged as unanchored
      And the finding tells the author to record the artifact path instead

  Rule: The R/G/R ledger's per-tick commit SHAs are untouched

    @artifact-content-phase-anchors.SM1.R5
    Scenario: In one push, anchors verify from the tree while ledger SHAs still verify from history
      Given a pushed range whose ticket carries a valid artifact-path anchor and a ledger tick SHA absent from history
      When the boundary command runs at the push boundary
      Then the anchor check passes
      And the ledger check still warns about the unreachable tick SHA
