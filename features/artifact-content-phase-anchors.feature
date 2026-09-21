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
  keep their history-backed validation unchanged. This is the sole acceptance
  source; evidence-anchored-phase-transitions.feature (#809's SHA grammar) was
  removed when this path grammar replaced it.

  Rule: A forward advance anchors the entered phase to the exited phase's artifact

    @artifact-content-phase-anchors.SM1.R1
    Scenario: Forward advance recording the exited phase's artifact path is anchored
      Given a feature ticket at phase plan-execution whose execution-plan artifact exists and is shape-valid
      When it advances to implement recording that artifact's path for implement
      Then the advance is recognized as anchored

    @artifact-content-phase-anchors.SM1.R1
    Scenario: Only the entered phase needs an anchor on a multi-step advance
      Given a feature ticket at phase define-behavior whose execution-plan artifact exists and is shape-valid
      When it advances four steps to implement recording that execution-plan path for implement only
      Then the advance is recognized as anchored

    @artifact-content-phase-anchors.SM1.R1
    Scenario: A stale prior-phase path does not invalidate the newly entered phase
      Given a feature ticket at phase plan-execution whose execution-plan is shape-valid and whose earlier define-behavior anchor path is absent
      When it advances to implement recording that artifact's path for implement
      Then the advance is recognized as anchored

    @artifact-content-phase-anchors.SM1.R1
    Scenario Outline: Each entered phase accepts its canonical exit-artifact kind
      Given a feature ticket at phase <prior phase> whose <artifact> anchor artifact exists and is shape-valid
      When it advances to <entered phase> recording that artifact path for <entered phase>
      Then the advance is recognized as anchored

      Examples:
        | prior phase         | entered phase       | artifact       |
        | intake              | define-behavior     | spec           |
        | define-behavior     | scenario-gate       | feature-source |
        | scenario-gate       | plan-implementation | feature-source |
        | plan-implementation | plan-execution      | impl-plan      |
        | plan-execution      | implement           | execution-plan |
        | implement           | verify              | ledger         |
        | verify              | done                | verify         |

    @artifact-content-phase-anchors.SM1.R1
    Scenario Outline: The scenario-gate anchor accepts the feature source or its legacy fallback
      Given a feature ticket at phase define-behavior whose <artifact> exists with scenario content
      When it advances to scenario-gate recording that <artifact> path for scenario-gate
      Then the advance is recognized as anchored

      Examples:
        | artifact                     |
        | feature source               |
        | legacy test-definitions file |

    @artifact-content-phase-anchors.SM1.R1
    Scenario: Re-advancing a phase is judged by its latest anchor entry
      Given a feature ticket that entered implement once, whose earlier implement anchor names a path absent from the tree
      When it re-enters implement appending an anchor naming its existing shape-valid execution-plan
      Then the advance is recognized as anchored

    @artifact-content-phase-anchors.SM1.R1
    Scenario: An earlier valid entry cannot rescue a re-advance whose latest anchor is stale
      Given a feature ticket whose earlier implement anchor names its existing shape-valid execution-plan
      When it re-enters implement appending an implement anchor whose path is absent from the tree
      Then the advance is flagged as unanchored

  Rule: An anchored advance verifies from the tree alone, under any history

    @artifact-content-phase-anchors.SM1.R2
    Scenario: Verification consults only the supplied tree, never git history
      Given a feature ticket in a working directory with no git repository at all, whose anchored artifact is readable in the tree
      When the advance is checked
      Then the advance is recognized as anchored

    @artifact-content-phase-anchors.SM1.R2
    Scenario: A squash-merged branch's ticket still verifies at the next boundary
      Given a project whose ticket advanced phases across several commits — an earlier phase anchored by a legacy hex SHA — that were then squash-merged into one
      When a further advance recording a path anchor for its entered phase reaches the push boundary
      Then it exits zero with no anchor warning
      And the audit entry records a passing phase-anchor verdict

    @artifact-content-phase-anchors.SM1.R2
    Scenario: An amended commit does not disturb a recorded anchor
      Given a project whose ticket recorded a path anchor in a commit that was then amended
      When the boundary command runs at the push boundary
      Then it exits zero with no anchor warning
      And the audit entry records a passing phase-anchor verdict

    @artifact-content-phase-anchors.SM1.R2
    Scenario: A rebased commit does not disturb a recorded anchor
      Given a project whose ticket recorded a path anchor in a commit that was then rebased
      When the boundary command runs at the push boundary
      Then it exits zero with no anchor warning
      And the audit entry records a passing phase-anchor verdict

    @artifact-content-phase-anchors.SM1.R2
    Scenario: A shallow clone's anchor check passes with no unreachable-history hedging
      Given a shallow single-depth clone of a project with an anchored feature ticket in the outgoing range
      When the boundary command runs at the push boundary
      Then it exits zero with no warning about unreachable history or shallow clones
      And the audit entry records a passing phase-anchor verdict

    @artifact-content-phase-anchors.SM1.R2
    Scenario: The commit tier verifies anchors against the staged tree, not the worktree
      Given a staged forward advance anchored to an execution-plan path that exists on disk but is not staged
      When the boundary command runs at the commit boundary
      Then it exits zero and warns that the anchored artifact is missing from the staged tree

    @artifact-content-phase-anchors.SM1.R2
    Scenario: The commit tier verifies the staged artifact's shape
      Given a staged forward advance anchored to an impl-plan that fails its shape check
      When the boundary command runs at the commit boundary
      Then it exits zero and warns that the anchored artifact fails its shape check

    @artifact-content-phase-anchors.SM1.R2
    Scenario: The push tier verifies anchors against the pushed HEAD tree, not the worktree
      Given a pushed forward advance anchored to an execution-plan path that exists in the worktree but not the pushed HEAD tree
      When the boundary command runs at the push boundary
      Then it exits zero and warns that the anchored artifact is missing from the pushed tree

  Rule: Ownership and configured lanes are resolved from canonical staged paths

    @artifact-content-phase-anchors.SM1.R6
    Scenario: A ticket cannot reuse another ticket's same-kind artifact
      Given a staged advance anchored to another ticket's shape-valid execution-plan
      When the boundary command runs at the commit boundary
      Then it exits zero and warns that the anchor is outside this ticket

    @artifact-content-phase-anchors.SM1.R6
    Scenario: A ticket cannot reuse another ticket's feature source
      Given a staged advance anchored to another ticket's feature source
      When the boundary command runs at the commit boundary
      Then it exits zero and warns that the anchor is outside this ticket

    @artifact-content-phase-anchors.SM1.R6
    Scenario: A configured non-default feature lane owns its feature anchors
      Given a staged project configuring a non-default feature lane and an advance anchored to a feature source inside it
      When the boundary command runs at the commit boundary
      Then it exits zero with no anchor warning

    @artifact-content-phase-anchors.SM1.R6
    Scenario: A Git index-stage prefix cannot alias a different artifact path
      Given a staged advance whose anchor uses a Git index-stage prefix
      When the boundary command runs at the commit boundary
      Then it exits zero and warns that the anchor is not repo-relative

    @artifact-content-phase-anchors.SM1.R6
    Scenario: Canonical feature ownership is independent of unstaged worktree state
      Given a staged owned feature source that is then removed from the worktree
      When the boundary command runs at the commit boundary
      Then it exits zero with no anchor warning

    @artifact-content-phase-anchors.SM1.R6
    Scenario: Feature anchors must live in an executable or configured feature lane
      Given a staged advance anchored to a correctly named feature inside its ticket directory but outside every feature lane
      When the boundary command runs at the commit boundary
      Then it exits zero and warns that the feature anchor is outside every executable or configured feature lane

    @artifact-content-phase-anchors.SM1.R6
    Scenario: Ticket discovery uses the staged project-root configuration
      Given a project-root configuration staged for a custom root while its worktree copy points at the default root
      When the boundary command runs at the commit boundary
      Then it exits zero and warns that the anchor is outside this ticket

    @artifact-content-phase-anchors.SM1.R6
    Scenario: Configured project roots normalize dot and separator segments
      Given a staged project root containing dot and duplicate separator segments
      When the boundary command runs at the commit boundary
      Then it exits zero and warns that the anchor is outside this ticket

    @artifact-content-phase-anchors.SM1.R6
    Scenario: Repository-root ticket ownership remains enforceable
      Given staged repository-root ticket and feature lanes with an anchor owned by another ticket
      When the boundary command runs at the commit boundary
      Then it exits zero and warns that the anchor is outside this ticket

    @artifact-content-phase-anchors.SM1.R6
    Scenario: A configured project root outside the repository warns instead of failing open
      Given a staged project-root configuration outside the repository
      When the boundary command runs at the commit boundary
      Then it exits zero and warns that the project root is outside the repository

  Rule: A forward advance without a real artifact behind it is detectable as unanchored

    @artifact-content-phase-anchors.SM1.R3
    Scenario: Forward advance with no phase_anchors block at all is flagged with the exact line to add
      Given a feature ticket at phase plan-execution
      When it advances to implement with no phase_anchors block recorded
      Then the advance is flagged as unanchored
      And the finding names the expected anchor line for implement

    @artifact-content-phase-anchors.SM1.R3
    Scenario: Forward advance whose phase_anchors block names only an earlier phase is flagged
      Given a feature ticket at phase plan-execution
      When it advances to implement with a phase_anchors block naming only plan-execution
      Then the advance is flagged as unanchored

    @artifact-content-phase-anchors.SM1.R3
    Scenario: Forward advance whose anchor value is empty is flagged
      Given a feature ticket at phase plan-execution
      When it advances to implement recording an empty anchor value for implement
      Then the advance is flagged as unanchored

    @artifact-content-phase-anchors.SM1.R3
    Scenario Outline: Forward advance whose anchor is not a plausible repo-relative path is flagged
      Given a feature ticket at phase plan-execution
      When it advances to implement recording "<value>" as the anchor for implement
      Then the advance is flagged as unanchored

      Examples:
        | value                         |
        | ../outside/execution-plan.md  |
        | /absolute/execution-plan.md   |
        | :(top)README.md               |
        | features/*.feature            |

    @artifact-content-phase-anchors.SM1.R3
    Scenario: Forward advance anchored to a path absent from the tree is flagged
      Given a feature ticket at phase plan-execution whose anchored path does not exist in the tree
      When it advances to implement recording that path for implement
      Then the advance is flagged as unanchored
      And the finding says the artifact is missing from the tree

    @artifact-content-phase-anchors.SM1.R3
    Scenario: Forward advance anchored to a hollow scaffold artifact is flagged
      Given a feature ticket at phase plan-implementation whose impl-plan artifact exists but fails its shape check
      When it advances to plan-execution recording that artifact's path for plan-execution
      Then the advance is flagged as unanchored
      And the finding says the artifact fails its shape check

    @artifact-content-phase-anchors.SM1.R3
    Scenario: Forward advance anchored to the wrong kind of artifact for the phase is flagged
      Given a feature ticket at phase verify with an existing README file in the tree
      When it advances to done recording the README path as the anchor for done
      Then the advance is flagged as unanchored
      And the finding says the artifact is not the expected kind for done

    @artifact-content-phase-anchors.SM1.R3
    Scenario: A recognized artifact kind cannot be cross-wired to another phase
      Given a feature ticket at phase plan-execution whose spec anchor artifact exists and is shape-valid
      When it advances to implement recording that artifact path for implement
      Then the advance is flagged as unanchored
      And the finding says the artifact is not the expected kind for implement

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
        | type |
        | task |
        | none |

    @artifact-content-phase-anchors.SM1.R3
    Scenario: A ticket becoming a feature past intake is not flagged
      Given a task ticket at phase implement with no anchors recorded
      When its type is changed to feature without changing the phase
      Then the advance is not flagged

    @artifact-content-phase-anchors.SM1.R3
    Scenario: An edit that leaves the phase unchanged is not flagged
      Given a feature ticket at phase implement with no anchors recorded
      When its body is edited without changing the phase
      Then the transition check raises no anchor finding

    @artifact-content-phase-anchors.SM1.R3
    Scenario: The at-rest advisory nudges a missing anchor with the path grammar
      Given a Safeword project with a feature ticket at rest at phase implement and no implement anchor
      When safeword check runs on the project
      Then safeword check advises the expected path-shaped anchor line for implement

  Rule: Legacy SHA anchors neither warn at rest nor block new work

    @artifact-content-phase-anchors.SM1.R4
    Scenario: A hex-shaped legacy anchor on a ticket at rest stays silent
      Given a feature ticket at rest at phase implement whose implement anchor is a hex-shaped commit SHA
      When the at-rest anchor advisory inspects it
      Then no anchor finding is raised

    @artifact-content-phase-anchors.SM1.R4
    Scenario: A new forward advance recording a hex-shaped anchor draws the migration remediation
      Given a feature ticket at phase plan-execution
      When it advances to implement recording a hex-shaped commit SHA as the anchor for implement
      Then the advance is flagged as unanchored
      And the finding identifies the legacy commit SHA migration
      And the finding names the expected anchor line for implement

    @artifact-content-phase-anchors.SM1.R4
    Scenario: A staged forward advance with a legacy anchor warns without blocking the commit
      Given a staged forward advance whose entered phase carries a hex-shaped legacy anchor
      When the boundary command runs at the commit boundary
      Then it exits zero and warns with the expected path-shaped anchor line

  Rule: The R/G/R ledger's per-tick commit SHAs are untouched

    @artifact-content-phase-anchors.SM1.R5
    Scenario: In one push, anchors verify from the tree while ledger SHAs still verify from history
      Given a pushed range whose ticket carries a valid artifact-path anchor and a ledger tick SHA absent from history
      When the boundary command runs at the push boundary
      Then the anchor check passes
      And the ledger check still warns about the unreachable tick SHA
