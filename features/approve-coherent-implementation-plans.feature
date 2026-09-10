Feature: Approve coherent Implementation Plans
  Safeword makes approach decisions complete and reviewable before execution is sequenced.

  @plan-implementability.TBU1.G1C9PP.R1
  Rule: plan-implementability.TBU1.G1C9PP.R1 — Implementation Planning is a distinct approach-decision phase

    @surface.safeword-cli
    Scenario Outline: Safeword CLI enforces and releases the decision boundary
      Given real project configuration and a ticket with <decision_state> and any required human design approval satisfied
      When the installed Safeword CLI requests Execution Planning
      Then <phase_result>

      Examples:
        | decision_state | phase_result |
        | an unresolved behavior-shaping choice | the workflow keeps the ticket in Implementation Planning and reports the unresolved choice |
        | all behavior-shaping choices resolved in a reviewed current plan | the workflow enters Execution Planning |

  @plan-implementability.TBU1.G1C9PP.R2
  Rule: plan-implementability.TBU1.G1C9PP.R2 — Authors and reviewers use one decision-quality contract

    Scenario Outline: Contract agreement controls review eligibility
      Given the Implementation Plan author and semantic reviewer receive <contract_state>
      When the plan is submitted for semantic review
      Then <review_result>

      Examples:
        | contract_state | review_result |
        | the same current decision-quality obligations | the plan is eligible for semantic review against those shared obligations |
        | contradictory decision-quality obligations | approval is blocked with the conflicting obligation named for contract reconciliation |

  @plan-implementability.TBU1.G1C9PP.R3
  Rule: plan-implementability.TBU1.G1C9PP.R3 — The plan opens with an architecture-at-a-glance mental model and keeps decision-bearing detail in the main review path without becoming an execution or evidence manual

    Scenario Outline: Decision presentation controls focused reviewability
      Given an Implementation Plan with <presentation>
      When its focused decision review is completed
      Then <reviewability_result>

      Examples:
        | presentation | reviewability_result |
        | a decision summary buried beneath step-by-step coding instructions and repeated test evidence | the plan fails focused reviewability and names the removable execution and evidence detail |
        | an architecture-at-a-glance mental model followed by decision-bearing contracts, operational risks, and unresolved authority with supporting detail linked | the plan passes focused reviewability |
        | a short summary that omits a load-bearing failure-posture decision | the plan fails focused reviewability because that decision is absent from the review path |

  @plan-implementability.TBU1.G1C9PP.R4
  Rule: plan-implementability.TBU1.G1C9PP.R4 — The Implementation Plan is a project-local reviewed artifact

    @surface.safeword-cli
    Scenario Outline: Safeword CLI accepts only the project-local Implementation Plan
      Given a feature ticket with <artifact_state>
      When Implementation Planning reaches review through the installed Safeword CLI entry point
      Then <artifact_result>

      Examples:
        | artifact_state | artifact_result |
        | the ticket's project-local plan | the plan is eligible for review |
        | only a host-private plan copy and no project-local plan | review is blocked until the ticket has a project-local plan |

    @surface.safeword-cli
    Scenario: A divergent host-private copy never becomes authoritative
      Given both the ticket's project-local plan and a divergent host-private copy exist
      When Implementation Planning reaches review through the installed Safeword CLI entry point
      Then the project-local plan is reviewed and the divergent host-private copy is not accepted

  @plan-implementability.TBU1.G1C9PP.R5
  Rule: plan-implementability.TBU1.G1C9PP.R5 — Architecture applicability is explicit

    Scenario Outline: Architecture applicability accepts consequences or a justified skip
      Given an Implementation Plan has <architecture_state>
      When the plan is reviewed
      Then <review_result>

      Examples:
        | architecture_state | review_result |
        | no architecture consequence and no applicability skip | approval is blocked until applicability is explicit |
        | no architecture consequence and a bare skip with no reason | approval is blocked until the skip is justified |
        | no architecture consequence and a justified applicability skip | architecture applicability does not block approval |
        | a recorded architecture consequence for a local component boundary | architecture applicability does not block approval |

  @plan-implementability.TBU1.G1C9PP.R6
  Rule: plan-implementability.TBU1.G1C9PP.R6 — Applicable data decisions cover purpose, store and model, schema and relationships, source of truth, ownership and access, identity and integrity, cross-system flow, lifecycle and retention, migration and backfill, compliance, and rollback at decision depth

    Scenario Outline: Data guidance follows data-contract applicability
      Given a feature has <data_state>
      When the Implementation Plan is reviewed
      Then <review_result>

      Examples:
        | data_state | review_result |
        | one persisted entity change that omits data ownership and migration decisions | approval is blocked with ownership and migration named |
        | one persisted entity change that omits retention and rollback consequences | approval is blocked with retention and rollback named |
        | purpose, store and model, schema and relationships, source of truth, ownership and access, identity and integrity, cross-system flow, lifecycle and retention, migration and backfill, compliance, and rollback decisions recorded without migration commands | data guidance does not block approval |
        | a persisted cross-system flow with no source of truth or access decision | approval is blocked with source of truth and access named |
        | a regulated backfill with no compliance consequence | approval is blocked with compliance named |
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
        | all decisions contained in the Implementation Plan | the receipt names it as the single design plan of record and requires no second design artifact |
        | all required decisions in the Implementation Plan with linked supporting detail outside it | the receipt names the Implementation Plan as the single design plan of record and accepts the supporting link |
        | a second feature design document carrying required decisions | approval is blocked until those decisions return to the Implementation Plan |

  @plan-implementability.TBU1.G1C9PP.R10
  Rule: plan-implementability.TBU1.G1C9PP.R10 — Implementation planning chooses proof scope and confidence without absorbing execution mechanics or the verification ledger

    Scenario Outline: Proof scope excludes execution mechanics
      Given an Implementation Plan has <proof_state>
      When proof completeness is reviewed
      Then <review_result>

      Examples:
        | proof_state | review_result |
        | behavior, real system boundary, proof type, and confidence limitation with no test paths or commands | the proof strategy is accepted for Implementation Planning |
        | behavior, real system boundary, proof type, confidence limitation, and a link to separately owned detailed evidence | the proof strategy is accepted for Implementation Planning |
        | behavior, real system boundary, proof type, and confidence limitation with test paths or commands | approval is blocked with the execution mechanic named for removal to Execution Planning |
        | current-head hashes, individual test names, and scenario-by-scenario proof results repeated in the main plan | approval is blocked with the verification ledger detail named for removal from the decision review path |
        | behavior, proof type, and confidence limitation but no real system boundary | approval is blocked with the missing real system boundary named |

  @plan-implementability.TBU1.G1C9PP.R11
  Rule: plan-implementability.TBU1.G1C9PP.R11 — Behavior-shaping decisions cannot leak into execution planning

    Scenario Outline: Decision resolution controls its Implementation Plan obligation
      Given an otherwise complete Implementation Plan with <decision_state>
      When the plan is reviewed
      Then <review_result>

      Examples:
        | decision_state | review_result |
        | an unresolved API contract | approval is blocked with the API contract named as an Implementation Planning obligation |
        | a resolved API contract | the API contract does not block approval |
        | unresolved rollback behavior | approval is blocked with rollback named as an Implementation Planning obligation |
        | resolved rollback behavior | rollback does not block approval |
        | unresolved proof scope | approval is blocked with proof scope named as an Implementation Planning obligation |
        | resolved proof scope | proof scope does not block approval |

    Scenario: A receipt reports every simultaneous decision blocker
      Given a plan has an unresolved API contract and unresolved rollback behavior
      When the plan is reviewed
      Then the receipt names the API contract and rollback behavior without requiring an order

  @plan-implementability.TBU1.G1C9PP.R12
  Rule: plan-implementability.TBU1.G1C9PP.R12 — Load-bearing choices carry alternatives and evidence

    Scenario Outline: Decision evidence controls semantic review
      Given a load-bearing technology choice with a named evidence baseline has <evidence_state>
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
        | an explicit no-load-bearing-choice skip contradicted by the plan's own load-bearing technology choice | blocked before approval |
        | a local non-load-bearing technology choice declared under a no-load-bearing-choice skip | eligible for semantic approval |
        | an explicit no-load-bearing-choice skip with a credible reason | eligible for semantic approval |

    Scenario Outline: Evidence presentation does not replace evidence completeness
      Given an Implementation Plan records <evidence_presentation>
      When structural and semantic evidence checks run
      Then <result>

      Examples:
        | evidence_presentation | result |
        | the decision, alternative, losing reason, evidence reference, retrieval date, and applicable version in the packaged table | eligible for semantic review |
        | the same complete information in concise prose and bullets | eligible for semantic review |
        | prose that omits the evidence reference and applicable version | blocked with the missing evidence fields named |

  @plan-implementability.TBU1.G1C9PP.R14
  Rule: plan-implementability.TBU1.G1C9PP.R14 — Decision discovery is scope-bounded and covers the consequential trust, operation, approval, and recovery needs of every accepted persona

    Scenario Outline: Discovery respects and updates scope only with user authority
      Given discovery has surfaced an in-scope policy choice and an out-of-scope capability with <scope_decision>
      When Implementation Planning converges
      Then the policy choice is decided and <scope_result>

      Examples:
        | scope_decision | scope_result |
        | no user-supplied scope-change approval | the capability remains outside the accepted plan |
        | a user-supplied scope-change approval in the session record | the capability enters the accepted plan and boundary |
        | only an agent-authored assertion that the user approved expansion | the capability remains outside the accepted plan |

    Scenario Outline: Persona consequence coverage controls approach approval
      Given the accepted Product Plan includes a persona who must <persona_need> and the Implementation Plan <coverage_state>
      When the Implementation Plan is reviewed
      Then <review_result>

      Examples:
        | persona_need | coverage_state | review_result |
        | trust the authorization and audit boundary | records that design consequence and its limit | persona coverage does not block approval |
        | trust the authorization and audit boundary | omits that consequence | approval is blocked with the uncovered trust need named |
        | operate the feature through its supported interface | records that design consequence and its limit | persona coverage does not block approval |
        | operate the feature through its supported interface | omits that consequence | approval is blocked with the uncovered operation need named |
        | approve rollout from truthful assurance | records that design consequence and its limit | persona coverage does not block approval |
        | approve rollout from truthful assurance | omits that consequence | approval is blocked with the uncovered approval need named |
        | recover safely after a refused operation | records that design consequence and its limit | persona coverage does not block approval |
        | recover safely after a refused operation | omits that consequence | approval is blocked with the uncovered recovery need named |

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
      Given a failed review addressed to a Technical Builder because a shared-contract choice has no durable architecture link
      When the review receipt is presented
      Then it preserves the failing check, Implementation Plan location, and durable-record obligation alongside the recovery

  @plan-implementability.TBU1.G1C9PP.R16
  Rule: plan-implementability.TBU1.G1C9PP.R16 — When planning and implementation states coexist, the plan distinguishes proposed decisions, implemented facts, available proof, known defects, and pending human authority without treating one as another

    Scenario Outline: Plan-state claims remain truthful
      Given an Implementation Plan is written after some implementation exists and <actual_state>
      When its decision review evaluates <plan_claim>
      Then <review_result>

      Examples:
        | actual_state | plan_claim | review_result |
        | code exists without current-boundary proof | the behavior is implemented and proven | approval is blocked because implementation is presented as proof |
        | current-boundary proof exists but human approval is pending | the feature is approved to release | approval is blocked because proof is presented as human authority |
        | an implementation defect contradicts the proposed decision | the proposed decision, implemented behavior, known defect, and pending correction are labeled separately | state truthfulness does not block approval |
        | no implementation exists yet | every approach entry is labeled proposed rather than implemented | state truthfulness does not block approval |

  @plan-implementability.TBU1.G1C9PP.R17
  Rule: plan-implementability.TBU1.G1C9PP.R17 — Significant concurrency, security, durability, lifecycle, migration, and compatibility choices include the applicable state, authority, atomicity, retry, and evidence model at decision depth

    Scenario Outline: Significant workflow decisions are complete at decision depth
      Given an architecturally significant workflow changes <concern> and the Implementation Plan records <decision_detail>
      When the Implementation Plan is reviewed
      Then <review_result>

      Examples:
        | concern | decision_detail | review_result |
        | durable state | legal states, transitions, transition authority, atomicity boundary, retry behavior, and preserved evidence | decision depth does not block approval |
        | authorization | permissions but no authority for a destructive transition | approval is blocked with the missing authority decision named |
        | migration | the target schema but no crash, retry, or compatibility behavior | approval is blocked with the missing migration decisions named |

  @plan-implementability.TBU1.G1C9PP.R18
  Rule: plan-implementability.TBU1.G1C9PP.R18 — Accepted quantitative promises carry a design-level measurement contract without moving Product-owned outcomes or Execution-owned instrumentation into the Implementation Plan

    Scenario Outline: Measurement detail stays with the phase that owns it
      Given the Product Plan promises a measurable outcome for a named population and condition and the Implementation Plan <measurement_state>
      When the Implementation Plan is reviewed
      Then <review_result>

      Examples:
        | measurement_state | review_result |
        | decides the origin, method, validity safeguards, and failure behavior | measurement design does not block approval |
        | changes the promised target or affected population | approval is blocked because Product-owned behavior was changed |
        | lists exact instrumentation commands but leaves validity unresolved | approval is blocked because execution detail replaced a design decision |

  @plan-implementability.TBU1.G1C9PP.R19
  Rule: plan-implementability.TBU1.G1C9PP.R19 — The existing optional human design approval occurs once on the semantically reviewed Implementation Plan before Execution Planning; it is not duplicated after the Execution Plan, and headless work records pending authority without deadlocking or claiming approval

    Scenario Outline: Human design authority follows configuration
      Given the human design-approval setting is <approval_setting>
      When a semantically reviewed Implementation Plan reaches the approval boundary
      Then <approval_result>

      Examples:
        | approval_setting | approval_result |
        | disabled | Execution Planning may begin without inventing a human approval |
        | enabled with an interactive approver | the reviewed approach is presented once for that person's decision |
        | enabled in a headless session | the reviewed approach is emitted with approval honestly pending |

    Scenario Outline: Human design authority follows approach currency
      Given human design approval is enabled and the reviewed approach has <approval_currency>
      When Execution Planning is requested
      Then <approval_result>

      Examples:
        | approval_currency | approval_result |
        | an approval that still binds its exact current plan | no further human decision is requested and Execution Planning proceeds on the existing approval |
        | changed so the prior approval no longer binds the current plan | the current approach requires a new human decision without defining review-invalidation machinery |

    Scenario: A completed Execution Plan does not trigger a second design approval
      Given the reviewed approach already has its required human approval and the dependent Execution Plan is complete
      When implementation is about to begin
      Then no second design approval is requested and implementation proceeds on the existing approach approval

  @plan-implementability.TBU1.G1C9PP.R20
  Rule: plan-implementability.TBU1.G1C9PP.R20 — An incomplete or incorrect plan returns to decision discovery with the full current set of blocking defects and is corrected and re-reviewed on its new exact bytes until complete and correct or honestly waiting on an external decision

    @demo @surface.safeword-cli
    Scenario: Review repairs every known plan defect before execution planning
      Given real project configuration and an Implementation Plan with a missing authorization boundary, an incorrect data owner, and no rollback decision
      When the installed Safeword CLI completes semantic review and the resulting decision-discovery repair loop
      Then the newly reviewed exact plan records the resolved authorization, data ownership, and rollback decisions with no blocking defect left for Execution Planning to invent

    Scenario: External authority pauses repair without disguising the plan as complete
      Given a plan defect requires a product owner to choose between two behaviorally different outcomes
      When no authorized decision is available during the repair loop
      Then the plan remains unapproved with the pending decision, its consequences, and the one resume action named

    Scenario Outline: Every corrected plan is re-reviewed until its current bytes are clean
      Given a plan has completed one repair round and its current exact bytes <correction_state>
      When those current bytes are reviewed again
      Then <review_result>

      Examples:
        | correction_state | review_result |
        | resolve every blocking defect | the plan is eligible to proceed from Implementation Planning |
        | still omit one required authorization decision | the plan remains blocked on that decision and returns to repair rather than being approved because one repair occurred |
