# Test Definitions: Artifact-content phase anchors

Feature source: `features/artifact-content-phase-anchors.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature`
source; this file tracks per-scenario RED → GREEN → REFACTOR with commit SHAs.
Two natural batches: the pure-predicate partitions (unit lane, one batched
R/G/R like RM84M8) and the boundary-command scenarios (temp-git-repo lane).
Supersedes RM84M8's ledger scope: `evidence-anchored-phase-transitions.feature`
and its steps are removed in this ticket's REFACTOR once these scenarios are
green.

Deliberate coverage notes (from the independent scenario review, applied
2026-07-08): per-kind shape partitions for spec.md / feature source / ledger /
verify.md are unit-lane only (dimensions.md test-layers note); done-gate ledger
isolation is carried by the existing regression suites. The 2026-07-25 quality
review added explicit rebase coverage and adversarial ticket/path binding
partitions after real CLI probes found two anchor-substitution gaps.

## Rule: A forward advance anchors the entered phase to the exited phase's artifact

### Scenario: Forward advance recording the exited phase's artifact path is anchored

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: Only the entered phase needs an anchor on a multi-step advance

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: The scenario-gate anchor accepts the feature source or its legacy fallback

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: Re-advancing a phase is judged by its latest anchor entry

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: An earlier valid entry cannot rescue a re-advance whose latest anchor is stale

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

## Rule: An anchored advance verifies from the tree alone, under any history

### Scenario: Verification consults only the supplied tree, never git history

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: A squash-merged branch's ticket still verifies at the next boundary

- [x] RED 73b9759
- [x] GREEN ea8bcf6
- [x] REFACTOR 5bd56ea

### Scenario: An amended commit does not disturb a recorded anchor

- [x] RED 73b9759
- [x] GREEN ea8bcf6
- [x] REFACTOR 5bd56ea

### Scenario: A rebased commit does not disturb a recorded anchor

- [x] RED 2cd0ef5
- [x] GREEN 356c4ee
- [x] REFACTOR a611f69

### Scenario: A shallow clone's anchor check passes with no unreachable-history hedging

- [x] RED 73b9759
- [x] GREEN ea8bcf6
- [x] REFACTOR 5bd56ea

### Scenario: The commit tier verifies anchors against the staged tree, not the worktree

- [x] RED 3b37b7f
- [x] GREEN ea8bcf6
- [x] REFACTOR 5bd56ea

## Rule: A forward advance without a real artifact behind it is detectable as unanchored

### Scenario: Forward advance with no phase_anchors block at all is flagged with the exact line to add

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: Forward advance whose phase_anchors block names only an earlier phase is flagged

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: Forward advance whose anchor value is empty is flagged

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: Forward advance whose anchor is not a plausible repo-relative path is flagged

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: Forward advance anchored to a path absent from the tree is flagged

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: Forward advance anchored to a hollow scaffold artifact is flagged

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: Forward advance anchored to the wrong kind of artifact for the phase is flagged

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: A ticket cannot reuse another ticket's same-kind artifact

- [x] RED 2cd0ef5
- [x] GREEN 356c4ee
- [x] REFACTOR a0e95de

### Scenario: A ticket cannot reuse another ticket's feature source

- [x] RED b5ed264
- [x] GREEN bdcb3cb
- [x] REFACTOR da20049

### Scenario: A Git index-stage prefix cannot alias a different artifact path

- [x] RED 2cd0ef5
- [x] GREEN 356c4ee
- [x] REFACTOR a0e95de

### Scenario: OS-native ticket paths are normalized to the anchor grammar

- [x] RED b5ed264
- [x] GREEN bdcb3cb
- [x] REFACTOR da20049

### Scenario: Canonical feature ownership is independent of unstaged worktree state

- [x] RED ae77c9d
- [x] GREEN 6a179bc
- [x] REFACTOR da20049

### Scenario: Feature anchors must live in an executable or configured feature lane

- [x] RED 4f1475d
- [x] GREEN eb7ef1e
- [x] REFACTOR da20049

### Scenario: Ticket discovery uses the staged project-root configuration

- [x] RED dfec6ce
- [x] GREEN 27ba49d
- [x] REFACTOR da20049

### Scenario: Configured project roots normalize dot and separator segments

- [x] RED ccc5783
- [x] GREEN 4dd7121
- [x] REFACTOR da20049

### Scenario: Repository-root ticket and feature lanes remain enforceable

- [x] RED 1f9fce8
- [x] GREEN fcb6d78
- [x] REFACTOR da20049

### Scenario: A configured project root outside the repository warns instead of failing open

- [x] RED 1f9fce8
- [x] GREEN fcb6d78
- [x] REFACTOR da20049

### Scenario: A backward phase move is not flagged

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: Re-declaring the same phase is not flagged

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: A non-feature ticket advancing is not flagged

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: A ticket becoming a feature past intake is not flagged

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: An edit that leaves the phase unchanged is not flagged

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: The at-rest advisory nudges a missing anchor with the path grammar

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

## Rule: Legacy SHA anchors neither warn at rest nor block new work

### Scenario: A hex-shaped legacy anchor on a ticket at rest stays silent

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

### Scenario: A new forward advance recording a hex-shaped anchor draws the migration remediation

- [x] RED e90eb07
- [x] GREEN 73b9759
- [x] REFACTOR 5bd56ea

## Rule: The R/G/R ledger's per-tick commit SHAs are untouched

### Scenario: In one push, anchors verify from the tree while ledger SHAs still verify from history

- [x] RED 73b9759
- [x] GREEN ea8bcf6
- [x] REFACTOR 5bd56ea

## Feature-level cross-scenario refactor

- [x] cross-scenario 5bd56ea
