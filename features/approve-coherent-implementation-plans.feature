Feature: Approve coherent Implementation Plans
  Safeword makes approach decisions complete and reviewable before execution is sequenced.

  @plan-implementability.TBU1.G1C9PP.R1
  Rule: plan-implementability.TBU1.G1C9PP.R1 — Implementation Planning is a distinct approach-decision phase

    Scenario Outline: Approach decision state controls entry into Execution Planning
      Given accepted feature behavior with <decision_state>
      When the workflow is asked to begin execution planning
      Then <phase_result>

      Examples:
        | decision_state | phase_result |
        | an unresolved behavior-shaping design choice | it remains in Implementation Planning and names the choice that must be decided |
        | every behavior-shaping design choice resolved in a reviewed current plan | it enters Execution Planning |

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Gated hosts enforce and release the decision boundary through the installed workflow
      Given real project configuration and a ticket with <decision_state>
      When <gated_host> requests Execution Planning through <dispatch_boundary>
      Then <phase_result>

      Examples:
        | gated_host | dispatch_boundary | decision_state | phase_result |
        | Safeword CLI | the installed CLI entry point | an unresolved behavior-shaping choice | the workflow keeps the ticket in Implementation Planning and reports the unresolved choice |
        | Safeword CLI | the installed CLI entry point | all behavior-shaping choices resolved in a reviewed current plan | the workflow enters Execution Planning |
        | Claude Code | installed lifecycle-hook dispatch | an unresolved behavior-shaping choice | the workflow keeps the ticket in Implementation Planning and reports the unresolved choice |
        | Claude Code | installed lifecycle-hook dispatch | all behavior-shaping choices resolved in a reviewed current plan | the workflow enters Execution Planning |
        | Claude Code Cloud | real project-level hook dispatch in the cloud lifecycle | an unresolved behavior-shaping choice | the workflow keeps the ticket in Implementation Planning and reports the unresolved choice |
        | Claude Code Cloud | real project-level hook dispatch in the cloud lifecycle | all behavior-shaping choices resolved in a reviewed current plan | the workflow enters Execution Planning |
        | OpenAI Codex | the installed workflow entry point | an unresolved behavior-shaping choice | the workflow keeps the ticket in Implementation Planning and reports the unresolved choice |
        | OpenAI Codex | the installed workflow entry point | all behavior-shaping choices resolved in a reviewed current plan | the workflow enters Execution Planning |
        | OpenCode CLI/TUI | installed plugin-event dispatch | an unresolved behavior-shaping choice | the workflow keeps the ticket in Implementation Planning and reports the unresolved choice |
        | OpenCode CLI/TUI | installed plugin-event dispatch | all behavior-shaping choices resolved in a reviewed current plan | the workflow enters Execution Planning |
        | Cursor | installed project-hook dispatch | an unresolved behavior-shaping choice | the workflow keeps the ticket in Implementation Planning and reports the unresolved choice |
        | Cursor | installed project-hook dispatch | all behavior-shaping choices resolved in a reviewed current plan | the workflow enters Execution Planning |
        | Cursor Cloud Agents | real project-level hook dispatch in the cloud lifecycle | an unresolved behavior-shaping choice | the workflow keeps the ticket in Implementation Planning and reports the unresolved choice |
        | Cursor Cloud Agents | real project-level hook dispatch in the cloud lifecycle | all behavior-shaping choices resolved in a reviewed current plan | the workflow enters Execution Planning |

  @plan-implementability.TBU1.G1C9PP.R2
  Rule: plan-implementability.TBU1.G1C9PP.R2 — Authors and reviewers use one decision-quality contract

    Scenario Outline: Contract identity controls review eligibility
      Given an Implementation Plan authored with <contract_state>
      When the plan is submitted for semantic review
      Then <review_result>

      Examples:
        | contract_state | review_result |
        | no resolvable reviewer contract | approval is blocked and contract restoration is the named recovery |
        | contract text whose content identity differs from the reviewer contract | approval is blocked and contract reconciliation is the named recovery |
        | contract text whose content identity exactly matches the reviewer contract | contract identity does not block semantic review |

  @plan-implementability.TBU1.G1C9PP.R3
  Rule: plan-implementability.TBU1.G1C9PP.R3 — Decisions remain reviewable without becoming an execution manual

    Scenario Outline: Decision presentation controls focused reviewability
      Given an Implementation Plan with <presentation>
      When its focused decision review is completed
      Then <reviewability_result>

      Examples:
        | presentation | reviewability_result |
        | a decision summary buried beneath step-by-step coding instructions | the plan fails focused reviewability |
        | a compact decision summary with linked supporting detail | the plan passes focused reviewability |

  @plan-implementability.TBU1.G1C9PP.R4
  Rule: plan-implementability.TBU1.G1C9PP.R4 — The Implementation Plan is a project-local reviewed artifact

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Each gated host accepts only the project-local Implementation Plan
      Given the same feature ticket is opened through <gated_host> with <artifact_state>
      When Implementation Planning reaches review
      Then <artifact_result>

      Examples:
        | gated_host | artifact_state | artifact_result |
        | Safeword CLI | the ticket's project-local plan | the plan is eligible for review |
        | Safeword CLI | a host-private plan copy | review is blocked in favor of the ticket's project-local plan |
        | Claude Code | the ticket's project-local plan | the plan is eligible for review |
        | Claude Code | a host-private plan copy | review is blocked in favor of the ticket's project-local plan |
        | Claude Code Cloud | the ticket's project-local plan reached through real cloud hook dispatch | the plan is eligible for review |
        | Claude Code Cloud | a host-private plan copy | review is blocked in favor of the ticket's project-local plan |
        | OpenAI Codex | the ticket's project-local plan | the plan is eligible for review |
        | OpenAI Codex | a host-private plan copy | review is blocked in favor of the ticket's project-local plan |
        | OpenCode CLI/TUI | the ticket's project-local plan reached through plugin-event dispatch | the plan is eligible for review |
        | OpenCode CLI/TUI | a host-private plan copy | review is blocked in favor of the ticket's project-local plan |
        | Cursor | the ticket's project-local plan | the plan is eligible for review |
        | Cursor | a host-private plan copy | review is blocked in favor of the ticket's project-local plan |
        | Cursor Cloud Agents | the ticket's project-local plan reached through real cloud hook dispatch | the plan is eligible for review |
        | Cursor Cloud Agents | a host-private plan copy | review is blocked in favor of the ticket's project-local plan |

    @surface.opencode
    Scenario: OpenCode Desktop guidance does not claim gate authority
      Given the OpenCode profile catalogue is used from advisory Desktop
      When its Implementation Planning guidance is shown
      Then it points to the project-local plan, claims no review or approval, and directs authoritative planning to a gated surface

  @plan-implementability.TBU1.G1C9PP.R5
  Rule: plan-implementability.TBU1.G1C9PP.R5 — Architecture applicability is explicit

    Scenario Outline: Architecture applicability accepts consequences or a justified skip
      Given an Implementation Plan has <architecture_state>
      When the plan is reviewed
      Then <review_result>

      Examples:
        | architecture_state | review_result |
        | no architecture consequence and no applicability skip | approval is blocked until applicability is explicit |
        | no architecture consequence and a justified applicability skip | architecture applicability does not block approval |
        | a recorded architecture consequence for a local component boundary | architecture applicability does not block approval |

  @plan-implementability.TBU1.G1C9PP.R6
  Rule: plan-implementability.TBU1.G1C9PP.R6 — Data guidance applies to data-contract changes

    Scenario Outline: Data guidance follows data-contract applicability
      Given a feature has <data_state>
      When the Implementation Plan is reviewed
      Then <review_result>

      Examples:
        | data_state | review_result |
        | one persisted entity change that omits data ownership and migration decisions | approval is blocked until the applicable data guidance is addressed |
        | one persisted entity change with data ownership and migration decisions recorded | data guidance does not block approval |
        | no data-contract, ownership, or lifecycle impact | data guidance does not block approval |

  @plan-implementability.TBU1.G1C9PP.R7
  Rule: plan-implementability.TBU1.G1C9PP.R7 — Significant decisions also enter the durable architecture record

    Scenario: Durable recording routes only significant decisions to the architecture record
      Given an Implementation Plan contains one reversible feature-local choice and one difficult-to-reverse shared-contract choice
      When the decisions' recording destinations are decided
      Then both appear in the plan and only the shared-contract choice is linked to a resolvable durable architecture record

    Scenario: An unrecorded significant decision blocks approval
      Given an Implementation Plan contains a difficult-to-reverse shared-contract choice with no resolvable durable architecture link
      When the plan is reviewed
      Then approval is blocked until the shared-contract choice is linked to a durable architecture record

  @plan-implementability.TBU1.G1C9PP.R8
  Rule: plan-implementability.TBU1.G1C9PP.R8 — Architectural significance uses semantic triggers

    Scenario: A one-file shared contract is significant while a many-file mechanical edit is not
      Given a one-file change alters a shared API and a many-file edit preserves every contract
      When architecture significance is evaluated
      Then the shared API change is significant and the mechanical edit is not

  @plan-implementability.TBU1.G1C9PP.R9
  Rule: plan-implementability.TBU1.G1C9PP.R9 — One feature has one design plan of record

    Scenario Outline: One design plan remains the feature plan of record
      Given a feature needs component and data design detail with <artifact_state>
      When the Implementation Plan is reviewed
      Then <review_result>

      Examples:
        | artifact_state | review_result |
        | all decisions contained in the Implementation Plan | its component boundary and data ownership decisions are accepted in that plan |
        | a second feature design document carrying required decisions | approval is blocked until those decisions return to the Implementation Plan |

  @plan-implementability.TBU1.G1C9PP.R10
  Rule: plan-implementability.TBU1.G1C9PP.R10 — Implementation planning chooses proof scope without execution mechanics

    Scenario Outline: Proof scope excludes execution mechanics
      Given a plan names the behavior, real system boundary, proof type, and confidence limitation with <mechanics_state>
      When proof completeness is reviewed
      Then <review_result>

      Examples:
        | mechanics_state | review_result |
        | no test file paths or commands | the proof strategy is accepted for Implementation Planning |
        | test file paths or commands mixed into the proof decision | approval is blocked with the execution mechanic named for removal to Execution Planning |

  @plan-implementability.TBU1.G1C9PP.R11
  Rule: plan-implementability.TBU1.G1C9PP.R11 — Behavior-shaping decisions cannot leak into execution planning

    @rejection
    Scenario Outline: Any unresolved behavior-shaping decision blocks the Implementation Plan
      Given an otherwise complete Implementation Plan with an unresolved <decision>
      When the plan is reviewed
      Then approval is blocked with <decision> named as an Implementation Planning obligation

      Examples:
        | decision |
        | API contract |
        | rollback |
        | proof scope |

  @plan-implementability.TBU1.G1C9PP.R12
  Rule: plan-implementability.TBU1.G1C9PP.R12 — Load-bearing choices carry alternatives and evidence

    Scenario Outline: Decision evidence controls semantic review
      Given a load-bearing technology choice is evaluated against a named evidence baseline and has <evidence_state>
      When the Implementation Plan is reviewed
      Then <review_result>

      Examples:
        | evidence_state | review_result |
        | current evidence but no credible alternative or losing tradeoff | approval is blocked until the alternative and why it lost are explicit |
        | current evidence, a credible alternative, and an explicit reason the alternative lost | decision evidence does not block approval |
        | a credible alternative and losing reason but evidence superseded by a named release after the choice | approval is blocked until the evidence is refreshed against that release |

  @plan-implementability.TBU1.G1C9PP.R13
  Rule: plan-implementability.TBU1.G1C9PP.R13 — Decision evidence is structurally present and semantically judged

    Scenario Outline: Evidence fields accept honest applicability without allowing empty decision coverage
      Given an Implementation Plan declares <decision_state>
      When structural and semantic evidence checks run
      Then the result is <result>

      Examples:
        | decision_state | result |
        | no decision entries and no skip | blocked before approval |
        | an explicit no-load-bearing-choice skip contradicted by the plan's own technology choice | blocked before approval |
        | an explicit no-load-bearing-choice skip with a credible reason | eligible for semantic approval |

  @plan-implementability.TBU1.G1C9PP.R14
  Rule: plan-implementability.TBU1.G1C9PP.R14 — Decision discovery is complete and scope-bounded

    Scenario Outline: Discovery respects and updates scope only with user authority
      Given discovery finds an in-scope policy choice and an out-of-scope capability with <scope_decision>
      When Implementation Planning converges
      Then the policy choice is decided and <scope_result>

      Examples:
        | scope_decision | scope_result |
        | no explicit user scope change | the capability remains outside the accepted plan |
        | explicit user approval to expand scope | the capability enters the accepted plan and boundary |

  @plan-implementability.TBU1.G1C9PP.R15
  Rule: plan-implementability.TBU1.G1C9PP.R15 — Review receipts expose decision reviewability and concrete recovery

    Scenario Outline: The receipt records the focused-review judgment
      Given an Implementation Plan is <reviewability>
      When its semantic review reaches a verdict
      Then the receipt records <receipt_result>

      Examples:
        | reviewability | receipt_result |
        | reviewable from its decision summary and linked detail | a reviewability pass |
        | obscured by execution detail | a reviewability failure naming the obscuring detail |

    Scenario: A blocked receipt gives a Non-Technical Builder a concrete recovery
      Given a failed review addressed to a Non-Technical Builder because a shared-contract choice has no durable architecture link
      When the review receipt is presented
      Then it says the shared-contract choice needs an architecture record without internal phase or type jargon and tells them to add that link before resubmitting

    Scenario: A blocked receipt preserves evidence for a Technical Builder
      Given the same failed review is addressed to a Technical Builder
      When the review receipt is presented
      Then it preserves the failing check, Implementation Plan location, and durable-record obligation alongside the recovery
