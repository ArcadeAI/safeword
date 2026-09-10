Feature: Split large contributions into independently reviewable PRs
  Safeword turns an accepted approach into coherent PR slices without losing obligations or reopening design.

  @plan-implementability.TBU2.6XW8H7.R1
  Rule: plan-implementability.TBU2.6XW8H7.R1 — Execution Planning explicitly decides whether a large contribution needs multiple pull requests

    @surface.safeword-cli
    Scenario Outline: Contribution shape produces an explicit slicing decision
      Given an accepted contribution is <contribution_shape>
      When its Execution Plan is authored through the installed Safeword CLI contract workflow
      Then the plan <slicing_outcome>

      Examples:
        | contribution_shape | slicing_outcome |
        | one coherent independently provable change | records one pull request and explains why another split would add no review value |
        | several dependency-ordered independently provable changes | records multiple pull requests and explains the chosen boundaries |

    @rejection @surface.safeword-cli
    Scenario: An omitted slicing decision cannot pass Execution Plan review
      Given an accepted contribution is large enough to contain several independently provable changes and its Execution Plan leaves pull-request slicing unspecified
      When the Execution Plan is reviewed through the installed Safeword CLI contract workflow
      Then the CLI-dispatched semantic review is denied because the contribution's review boundaries remain undecided

    @surface.safeword-cli
    Scenario: Installed review dispatch carries the canonical slicing contract
      Given real installed Safeword CLI configuration and a deterministic recorder replacing only the external reviewer process
      When the CLI dispatches Execution Plan review
      Then the recorder receives the exact canonical contract whose content digest matches the installed contract and whose R1 through R5 clauses require the slicing decision, slice completeness, dependency safety, conceptual reviewability, and obligation preservation

  @plan-implementability.TBU2.6XW8H7.R2
  Rule: plan-implementability.TBU2.6XW8H7.R2 — Each planned pull request has one coherent purpose, boundary, prerequisite set, proof obligation, and completion signal and can be implemented without inventing a design decision

    @surface.safeword-cli
    Scenario: A complete pull-request slice receives a complete review record
      Given a planned pull request names one purpose, its boundary, every prerequisite, its proof, and its completion signal
      When the Execution Plan is reviewed through the installed Safeword CLI contract workflow
      Then the CLI-dispatched semantic review records the slice eligible for independent review without an invented design decision

    @rejection @surface.safeword-cli
    Scenario Outline: An incomplete pull-request slice is rejected
      Given a planned pull request omits <missing_element>
      When the Execution Plan is reviewed through the installed Safeword CLI contract workflow
      Then the CLI-dispatched semantic review is denied with <missing_element> named as required for that slice

      Examples:
        | missing_element |
        | its coherent purpose |
        | its boundary |
        | its prerequisite set |
        | its proof obligation |
        | its completion signal |

    @rejection @surface.safeword-cli
    Scenario: A pull-request slice with two independent purposes is rejected
      Given one planned pull request combines two independently valuable purposes that can be reviewed and proven separately
      When the Execution Plan is reviewed through the installed Safeword CLI contract workflow
      Then the CLI-dispatched semantic review is denied until each slice has one coherent purpose

    @rejection @surface.safeword-cli
    Scenario: A formally complete slice cannot leave a design decision to its implementer
      Given a planned pull request names its purpose, boundary, prerequisites, proof, and completion signal but leaves the shared authorization boundary undecided
      When the Execution Plan is reviewed through the installed Safeword CLI contract workflow
      Then the CLI-dispatched semantic review is denied with the unresolved authorization decision named for Implementation Planning

  @plan-implementability.TBU2.6XW8H7.R3
  Rule: plan-implementability.TBU2.6XW8H7.R3 — Pull-request dependencies are ordered explicitly and every merge leaves the repository in a safe supported state

    @surface.safeword-cli
    Scenario: Ordered slices preserve a supported repository after every merge
      Given a schema-addition slice precedes a dependent reader-activation slice and each intermediate state supports the accepted behavior
      When the Execution Plan is reviewed through the installed Safeword CLI contract workflow
      Then the semantic review records the schema addition before reader activation and no slice as relying on an unmerged successor

    @rejection @surface.safeword-cli
    Scenario: A slice that becomes safe only after a later merge is rejected
      Given an earlier pull request exposes a required workflow state that only a later pull request can handle
      When the Execution Plan is reviewed through the installed Safeword CLI contract workflow
      Then the CLI-dispatched semantic review is denied with the unsafe intermediate merge and its missing prerequisite named

  @plan-implementability.TBU2.6XW8H7.R4
  Rule: plan-implementability.TBU2.6XW8H7.R4 — Reviewable size is judged by conceptual scope and independent proof rather than line or file count alone

    @surface.safeword-cli
    Scenario Outline: Conceptual scope determines reviewable slicing
      Given a contribution has <change_shape>
      When its reviewability is assessed through the installed Safeword CLI contract workflow
      Then the plan <reviewability_outcome>

      Examples:
        | change_shape | reviewability_outcome |
        | many mechanical file edits proven by one shared outcome test | records one coherent conceptual concern and names its shared proof |
        | few file edits carrying two outcomes that can each be reviewed and proven independently | records two independent conceptual concerns and names the proof for each |

    @rejection @surface.safeword-cli
    Scenario: Line count alone cannot justify a slicing decision
      Given an Execution Plan calls a pull request reviewable only because it is below a line-count threshold
      When the plan is reviewed through the installed Safeword CLI contract workflow
      Then the CLI-dispatched semantic review is denied until conceptual scope and independent proof justify the boundary

  @plan-implementability.TBU2.6XW8H7.R5
  Rule: plan-implementability.TBU2.6XW8H7.R5 — PR slicing preserves every accepted behavior, migration, rollout, rollback, documentation, and affected-surface obligation without reopening the approach

    @surface.safeword-cli
    Scenario: Accepted obligations remain assigned across pull-request slices
      Given an accepted approach has behavior, migration, rollout, rollback, documentation, and affected-surface obligations and its Execution Plan proposes pull-request slices
      When the Execution Plan is reviewed through the installed Safeword CLI contract workflow
      Then the semantic review records the owning slice for every obligation

    @surface.safeword-cli
    Scenario: Accepted decisions remain unchanged across pull-request slices
      Given an accepted approach has recorded design decisions and its Execution Plan proposes pull-request slices
      When the Execution Plan is reviewed through the installed Safeword CLI contract workflow
      Then the semantic review reports every accepted decision unchanged by the slicing plan

    @rejection @surface.safeword-cli
    Scenario Outline: A slicing plan cannot discard an accepted obligation
      Given the accepted approach requires <obligation> and no planned pull request owns that obligation
      When the Execution Plan is reviewed through the installed Safeword CLI contract workflow
      Then the CLI-dispatched semantic review is denied with the unassigned <obligation> named

      Examples:
        | obligation |
        | accepted behavior |
        | migration work |
        | rollout work |
        | rollback work |
        | documentation work |
        | an affected-surface obligation |

    @rejection @surface.safeword-cli
    Scenario: A pull-request slice cannot rewrite an accepted approach decision
      Given a planned pull request restates an accepted authorization decision with a different responsibility boundary
      When the Execution Plan is reviewed through the installed Safeword CLI contract workflow
      Then the CLI-dispatched semantic review is denied with the reopened authorization decision named
