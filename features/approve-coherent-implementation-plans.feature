Feature: Approve coherent Implementation Plans
  Safeword makes approach decisions complete and reviewable before execution is sequenced.

  @plan-implementability.TBU1.G1C9PP.R1
  Rule: plan-implementability.TBU1.G1C9PP.R1 — Implementation planning is a distinct approach-decision phase

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    @rejection
    Scenario: Unresolved approach choices cannot be deferred into execution planning
      Given accepted feature behavior with an unresolved behavior-shaping design choice
      When the workflow is asked to begin execution planning
      Then it remains in Implementation Planning and names the approach choice that must be decided

  @plan-implementability.TBU1.G1C9PP.R2
  Rule: plan-implementability.TBU1.G1C9PP.R2 — Authors and reviewers use one decision-quality contract

    @rejection
    Scenario: An authoring contract that differs from the reviewer contract cannot approve a plan
      Given an Implementation Plan authored with contract text whose content identity differs from the reviewer contract
      When the plan is submitted for semantic review
      Then approval is blocked and contract reconciliation is the named recovery

  @plan-implementability.TBU1.G1C9PP.R3
  Rule: plan-implementability.TBU1.G1C9PP.R3 — Decisions remain reviewable without becoming an execution manual

    @rejection
    Scenario: Execution detail that obscures the decision summary fails reviewability
      Given an Implementation Plan whose decision summary is buried beneath step-by-step coding instructions
      When its focused decision review is completed
      Then the plan fails reviewability with the obscuring execution detail named

  @plan-implementability.TBU1.G1C9PP.R4
  Rule: plan-implementability.TBU1.G1C9PP.R4 — The Implementation Plan is a project-local reviewed artifact

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    @rejection
    Scenario: Supported hosts use the same project-local Implementation Plan boundary
      Given the same feature ticket is opened through each affected host
      When Implementation Planning reaches review
      Then each host submits the ticket's project-local Implementation Plan rather than a host-private plan

  @plan-implementability.TBU1.G1C9PP.R5
  Rule: plan-implementability.TBU1.G1C9PP.R5 — Architecture applicability is explicit

    @rejection
    Scenario: Omitting both architecture consequences and a justified skip blocks approval
      Given an Implementation Plan with no architecture consequence and no architecture-applicability skip
      When the plan is reviewed
      Then approval is blocked until architecture applicability is resolved explicitly

  @plan-implementability.TBU1.G1C9PP.R6
  Rule: plan-implementability.TBU1.G1C9PP.R6 — Data guidance applies to data-contract changes

    @rejection
    Scenario: A simple schema change cannot use the retired small-schema exemption
      Given a feature changes one persisted entity and omits data ownership and migration decisions
      When the Implementation Plan is reviewed
      Then approval is blocked until the applicable data guidance is addressed

  @plan-implementability.TBU1.G1C9PP.R7
  Rule: plan-implementability.TBU1.G1C9PP.R7 — Significant decisions also enter the durable architecture record

    @rejection
    Scenario: Durable recording follows significance rather than applying to every choice
      Given one reversible feature-local choice and one difficult-to-reverse shared-contract choice
      When their recording destinations are decided
      Then both appear in the Implementation Plan and only the shared-contract choice is linked to a durable architecture record

  @plan-implementability.TBU1.G1C9PP.R8
  Rule: plan-implementability.TBU1.G1C9PP.R8 — Architectural significance uses semantic triggers

    @rejection
    Scenario: A one-file shared contract is significant while a many-file mechanical edit is not
      Given a one-file change alters a shared API and a many-file edit preserves every contract
      When architecture significance is evaluated
      Then the shared API change is significant and the mechanical edit is not

  @plan-implementability.TBU1.G1C9PP.R9
  Rule: plan-implementability.TBU1.G1C9PP.R9 — One feature has one design plan of record

    @rejection
    Scenario: Retained guidance cannot create a second feature design artifact
      Given a feature needs component and data design detail
      When all applicable planning and architecture guidance is followed
      Then every feature-local design decision lands in one Implementation Plan with no second design document

  @plan-implementability.TBU1.G1C9PP.R10
  Rule: plan-implementability.TBU1.G1C9PP.R10 — Implementation planning chooses proof scope without execution mechanics

    @rejection
    Scenario: A proof strategy is complete before fixture and command details exist
      Given a plan names the behavior, real system boundary, proof type, and confidence limitation but not test file paths or commands
      When proof completeness is reviewed
      Then the proof strategy is accepted for Implementation Planning and mechanics remain for Execution Planning

  @plan-implementability.TBU1.G1C9PP.R11
  Rule: plan-implementability.TBU1.G1C9PP.R11 — Behavior-shaping decisions cannot leak into execution planning

    @rejection
    Scenario Outline: Any unresolved behavior-shaping decision blocks the Implementation Plan
      Given an otherwise complete Implementation Plan with an unresolved <decision>
      When the plan is reviewed
      Then approval is blocked with <decision> named as an Implementation Planning obligation

      Examples:
        | decision |
        | responsibility boundary |
        | API or data contract |
        | authorization and failure behavior |
        | compatibility and migration behavior |
        | rollout, rollback, or proof scope |

  @plan-implementability.TBU1.G1C9PP.R12
  Rule: plan-implementability.TBU1.G1C9PP.R12 — Load-bearing choices carry alternatives and evidence

    @rejection
    Scenario: A preferred choice without rejected alternatives cannot pass semantic review
      Given a load-bearing technology choice names current evidence but no credible alternative or losing tradeoff
      When the Implementation Plan is reviewed
      Then approval is blocked until the alternative and why it lost are explicit

  @plan-implementability.TBU1.G1C9PP.R13
  Rule: plan-implementability.TBU1.G1C9PP.R13 — Decision evidence is structurally present and semantically judged

    @rejection
    Scenario Outline: Evidence fields accept honest applicability without allowing empty decision coverage
      Given an Implementation Plan declares <decision_state>
      When structural and semantic evidence checks run
      Then the result is <result>

      Examples:
        | decision_state | result |
        | no decision entries and no skip | blocked before approval |
        | an explicit no-load-bearing-choice skip with a credible reason | eligible for semantic approval |
        | a local ownership choice with version marked not applicable | eligible for semantic approval |
        | an external dependency choice without retrieval date or version | blocked before approval |

  @plan-implementability.TBU1.G1C9PP.R14
  Rule: plan-implementability.TBU1.G1C9PP.R14 — Decision discovery is complete and scope-bounded

    @rejection
    Scenario: Discovery resolves in-scope dimensions and rejects silent scope expansion
      Given discovery finds one required in-scope policy choice and one attractive out-of-scope capability
      When Implementation Planning converges
      Then the policy choice is decided while the capability remains outside the accepted plan pending an explicit user scope decision

  @plan-implementability.TBU1.G1C9PP.R15
  Rule: plan-implementability.TBU1.G1C9PP.R15 — Review receipts expose decision reviewability

    @rejection
    Scenario Outline: The receipt records the focused-review judgment
      Given an Implementation Plan is <reviewability>
      When its semantic review reaches a verdict
      Then the receipt records <receipt_result>

      Examples:
        | reviewability | receipt_result |
        | reviewable from its decision summary and linked detail | a reviewability pass |
        | obscured by execution detail | a reviewability failure naming the obscuring detail |
