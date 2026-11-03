# Behavior source for T0FK4H (GitHub #6316, PR #6319). Written 2026-11-03,
# after implementation. Its executable backing is Vitest coverage in
# packages/cli/tests/review/ and packages/cli/tests/integration/; cucumber steps
# would duplicate that harness without adding confidence.
@qualify-additional-reviewer-pairs @proof.vitest
Feature: Qualify additional reviewer pairs without retiring the existing pair

  The packaged reviewer-capability catalogue holds several pinned Claude/Codex
  pairs. Each record counts only for its own pair, and a new pair stays
  unqualified until its sealed evidence exists.

  Rule: Each pinned pair has its own revision, and the shipped pair's revision is unchanged

    Scenario: The latest pinned pair gets its own settings revision
      Given the shipped pair and the latest pair are both pinned
      When their capability revisions are derived
      Then each pair has a distinct settings digest over the same corpus and rubric

    Scenario: The shipped pair keeps its exact settings digest
      Given the shipped pair is pinned in the pair list
      When its revision is derived
      Then its settings digest is still acd5a699

  Rule: A capability record counts only for the pinned pair it was qualified with

    Scenario: Each pinned pair is admitted at its own settings revision
      Given qualified records for two pinned pairs at different settings revisions
      When capability is compared for either pair
      Then each pair is admitted using its own revision

    Scenario: A second qualified pair is admitted through planning review
      Given the latest pair has complete sealed evidence
      When a planning review routes to its Codex reviewer
      Then the reviewer is admitted cross-agent

  Rule: Only pairs with complete, matching sealed evidence enter the shipped catalogue

    Scenario: Partial, cross-pair or shared-model evidence is refused
      Given evidence for only one model, another pair's models, or a shared model
      When the catalogue is built
      Then the build fails instead of omitting the pair

    Scenario: Rescoring refuses partial or mismatched evidence
      Given a pinned pair with evidence for only one model
      When the maintainer rescores evidence
      Then rescoring fails before writing any file

    Scenario: The catalogue emits only pinned pairs with complete evidence
      Given sealed evidence exists for only one of two pinned pairs
      When the catalogue is built
      Then only that pair is emitted and the other is listed as unqualified
