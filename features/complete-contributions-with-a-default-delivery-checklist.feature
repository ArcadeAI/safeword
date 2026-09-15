Feature: Complete contributions with a default delivery checklist
  Safeword creates a proportionate checklist before execution and carries it to evidence-backed contributor readiness.

  @plan-implementability.TBU2.A639WN.R1
  Rule: plan-implementability.TBU2.A639WN.R1 — The Safeword CLI exposes a deny-only execution prerequisite that requires, and reports in planning order, accepted scenarios, an accepted implementation approach, and one visible default Delivery Checklist

    @surface.safeword-cli
    Scenario: The installed CLI exposes a satisfied execution prerequisite
      Given a behavior-changing feature has accepted scenarios and an accepted implementation approach
      And the contribution's existing Execution Plan contains an admitted default Delivery Checklist
      When Safeword checks the execution prerequisite through the installed CLI
      Then the CLI returns only a satisfied prerequisite verdict and no coding or merge authorization

    @surface.safeword-cli @rejection
    Scenario Outline: Missing contribution context blocks execution readiness
      Given the installed CLI workflow has a behavior-changing feature missing <required_context>
      When Safeword checks the execution prerequisite through the installed CLI
      Then the prerequisite is denied in plain language with the reason progress stopped and one concrete action to supply <required_context>

      Examples:
        | required_context |
        | accepted scenarios |
        | an accepted implementation approach |
        | an admitted default Delivery Checklist |

    @surface.safeword-cli @rejection
    Scenario: Several missing prerequisites are reported in deterministic planning order
      Given the installed CLI workflow has a behavior-changing feature missing accepted scenarios, an accepted implementation approach, and an admitted default Delivery Checklist
      When Safeword checks the execution prerequisite through the installed CLI
      Then the denial lists accepted scenarios, the accepted implementation approach, and the admitted default Delivery Checklist in that order with one concrete action for each

  @plan-implementability.TBU2.A639WN.R2 @surface.safeword-cli
  Rule: plan-implementability.TBU2.A639WN.R2 — The feature Delivery Checklist covers outcome and scope, resolved decisions, dependency and pull-request decomposition, testing, data and compatibility, monitoring and failure signals, security and privacy, rollout and rollback, documentation, ownership and human dependencies, and concrete completion evidence

    Scenario: A complete checklist exposes every default obligation category
      Given a contribution is ready to begin execution
      When Safeword presents its Delivery Checklist through the installed CLI
      Then the checklist covers outcome and scope, resolved decisions, dependency and pull-request decomposition, testing, data and compatibility, monitoring and failure signals, security and privacy, rollout and rollback, documentation, ownership and human dependencies, and concrete completion evidence

    @rejection
    Scenario Outline: A silently omitted default category prevents checklist completion
      Given a Delivery Checklist omits <category>
      When Safeword evaluates checklist completeness through the installed CLI
      Then completion is denied with the missing <category> category named and one concrete action to add it

      Examples:
        | category |
        | testing |
        | concrete completion evidence |

  @plan-implementability.TBU2.A639WN.R3 @surface.safeword-cli
  Rule: plan-implementability.TBU2.A639WN.R3 — Safeword carries the checklist through feature execution rather than using it only as an end-of-work audit, and each category is completed with evidence, marked not applicable with a concrete reason, or recorded as an explicit human-owned dependency

    Scenario Outline: An applicable item records an honest disposition
      Given a checklist item is <item_state>
      When Safeword updates the Delivery Checklist through the installed CLI
      Then the item <recorded_disposition>

      Examples:
        | item_state | recorded_disposition |
        | completed by the contributor | records concrete completion evidence |
        | genuinely irrelevant to the contribution | records not applicable with a concrete reason |
        | controlled only by an authorized human | records the named human-owned dependency as pending |

    @rejection
    Scenario: Contributor-controlled work cannot be dismissed as a human handoff
      Given an applicable test obligation can be completed by the contributor
      When it is marked through the installed CLI as a human-owned dependency instead of being completed
      Then the human-owned disposition is rejected, the test obligation remains open, and the response tells the contributor to complete it

    @rejection @live
    Scenario: Applicable contributor work cannot be dismissed as not applicable
      Given an applicable test obligation is required by the accepted proof boundary
      When it is marked through the installed CLI as not applicable
      Then the not-applicable disposition is rejected, the test obligation remains open, and the response names the accepted proof boundary

    Scenario: In-flight checklist state reflects partial execution progress
      Given feature execution has completed its test obligation while monitoring and documentation remain open
      When Safeword updates delivery state through the installed CLI before execution ends
      Then the Delivery Checklist exposes the recorded test evidence while execution remains in progress and names monitoring and documentation as the next open obligations

    @rejection
    Scenario: An unreadable Execution Plan blocks checklist updates
      Given feature execution has begun and its Execution Plan cannot be read
      When Safeword attempts to update the Delivery Checklist through the installed CLI
      Then the update is blocked with one concrete action to repair the named Execution Plan and no replacement checklist is silently regenerated

  @plan-implementability.TBU2.A639WN.R4 @surface.safeword-cli
  Rule: plan-implementability.TBU2.A639WN.R4 — The feature checklist lives in the Execution Plan; the 3EG00H TBU3 small-work contract separately owns proportionate task and patch checklist behavior without creating feature artifacts

    Scenario: The feature Delivery Checklist lives in the Execution Plan
      Given a behavior-changing feature has an accepted implementation approach
      When Safeword creates its Delivery Checklist through the installed CLI
      Then the checklist is recorded only in the feature Execution Plan and no separate checklist artifact is created

    @rejection
    Scenario Outline: The feature checklist contract cannot impose feature artifacts on smaller work
      Given a contribution is classified as <small_work_type> under the TBU3 small-work contract
      When the feature Delivery Checklist contract is evaluated through the installed CLI
      Then no feature Implementation Plan or Execution Plan is created

      Examples:
        | small_work_type |
        | task |
        | patch |

  @plan-implementability.TBU2.A639WN.R5 @surface.safeword-cli
  Rule: plan-implementability.TBU2.A639WN.R5 — Large feature contributions use the reviewable pull-request slicing contract from child 6XW8H7, while a contribution small enough for one coherent review records that decision without artificial decomposition

    Scenario Outline: The checklist records the appropriate PR-slicing outcome
      Given a contribution contains <change_shape>
      When Safeword completes its work-decomposition checklist item through the installed CLI
      Then the checklist <slicing_outcome>

      Examples:
        | change_shape | slicing_outcome |
        | several dependency-ordered independently provable changes | references the coherent pull-request slices defined by the Execution Plan |
        | one coherent independently provable change | records one pull request and why another split would add no review value |

    @rejection
    Scenario: A large contribution cannot leave PR slicing unresolved
      Given a contribution contains several independently provable changes and its checklist has no pull-request slicing decision
      When Safeword reviews the Execution Plan through the installed CLI
      Then the plan is denied, the item remains open, and the missing pull-request slicing decision is named with one concrete action to record it

  @plan-implementability.TBU2.A639WN.R6 @surface.safeword-cli
  Rule: plan-implementability.TBU2.A639WN.R6 — Safeword reports contributor readiness only when every contributor-controlled obligation is completed and proven, reports pending human approvals or ownership as unresolved dependencies, and never treats readiness evidence as human approval or merge authority

    Scenario Outline: Readiness reports the next owning boundary without inventing authority
      Given <remaining_state>
      When Safeword reports the contribution's state through the installed CLI
      Then <readiness_result>

      Examples:
        | remaining_state | readiness_result |
        | a contributor-controlled checklist item is incomplete | it reports contributor work incomplete with that item named |
        | every contributor-controlled item is marked complete but a required real-boundary proof is only partial or structural | it reports contributor work incomplete with the unproven item and its evidence class named |
        | every contributor-controlled item is marked complete but a required proof is from an incompatible earlier revision | it reports contributor work incomplete with the unproven item and its evidence class named |
        | every contributor-controlled item is proven by compatible reusable earlier-revision evidence and required human approval is pending | it reports ready for human review with the reusable evidence limitation and pending approval named |
        | every contributor-controlled item is proven and required human approval is pending | it reports ready for human review with the pending approval named |
        | required human approval is recorded but merge authority has not been granted | it reports the approval satisfied while keeping merge authorization pending |

    @rejection
    Scenario: Contributor evidence cannot record human approval
      Given every contributor-controlled item is proven and required human approval is pending
      When the contributor records the approval through the installed CLI without the authorized human's authority
      Then the approval remains pending and readiness still reports ready for human review

  @plan-implementability.TBU2.A639WN.R7 @surface.safeword-cli
  Rule: plan-implementability.TBU2.A639WN.R7 — This child defines the canonical Delivery Checklist evidence-currency taxonomy—current-revision real-boundary proof, reusable earlier-revision proof, partial or structural proof, and missing proof—and never silently upgrades one class into another

    Scenario Outline: Evidence class controls the claim Safeword may make
      Given a checklist obligation has <evidence_state>
      When Safeword records its delivery evidence through the installed CLI
      Then the checklist <evidence_result>

      Examples:
        | evidence_state | evidence_result |
        | proof at the current contribution revision through the required real boundary | records the obligation proven at the current revision |
        | compatible proof retained from an earlier revision | records the reusable evidence and its earlier-revision limitation |
        | structural or partial proof that does not exercise the required boundary | records the narrower proof class and keeps the boundary obligation open |
        | no proof | records the obligation unproven |

    @rejection
    Scenario: Earlier or partial evidence cannot silently become current complete proof
      Given a required real-boundary obligation has only partial evidence from an earlier revision
      When Safeword records its delivery evidence through the installed CLI
      Then the evidence remains classified as earlier-revision partial proof with both gaps named and the real-boundary obligation open
