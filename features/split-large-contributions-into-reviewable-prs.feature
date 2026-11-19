# Semantic outcomes run the real CLI/reviewer conformance cases in the live lane.
# The default Vitest manifest covers only deterministic contract-dispatch wiring.
# Corpus metadata is supporting evidence, never a semantic verdict.
# Live results describe the recorded reviewer/model run; default CI does not certify them.
Feature: Split large contributions into independently reviewable PRs
  Safeword turns an accepted approach into coherent PR slices without losing obligations or reopening design.

  @plan-implementability.TBU2.6XW8H7.R1
  Rule: plan-implementability.TBU2.6XW8H7.R1 — Execution Planning explicitly decides whether a large contribution needs multiple pull requests

    @surface.safeword-cli
    @proof.vitest
    Scenario: Installed review dispatch carries the generated slicing rubric
      Given packaged Safeword CLI configuration and a deterministic recorder replacing only the external reviewer process
      When the CLI dispatches Execution Plan review
      Then the recorder receives the generated reviewer rubric with its matching content digest and declares the five slicing obligation labels
