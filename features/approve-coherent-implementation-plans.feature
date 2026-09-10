Feature: Approve coherent Implementation Plans
  Safeword makes approach decisions complete and reviewable before execution is sequenced.
  Untagged semantic scenarios evaluate the real packaged review contract through a deterministic contract-conformance reviewer fixture; tagged scenarios additionally prove installed CLI wiring.

  @plan-implementability.TBU1.G1C9PP.R1
  Rule: plan-implementability.TBU1.G1C9PP.R1 — Implementation Planning is a distinct approach-decision phase

    @surface.safeword-cli
    Scenario Outline: Safeword CLI enforces and releases the decision boundary
      Given real project configuration, a ticket with <decision_state>, and human design approval is not required
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

    @surface.safeword-cli
    Scenario: A missing packaged contract blocks installed review
      Given real project configuration and no packaged decision-quality contract is reachable
      When the installed Safeword CLI prepares Implementation Plan review through real internal collaborators
      Then authoring and approval are blocked with the regenerate action named

  @plan-implementability.TBU1.G1C9PP.R3
  Rule: plan-implementability.TBU1.G1C9PP.R3 — The plan opens with an architecture-at-a-glance mental model and keeps decision-bearing detail in the main review path without becoming an execution or evidence manual

    Scenario Outline: Decision presentation controls focused reviewability
      Given an Implementation Plan with <presentation>
      When its focused decision review is completed
      Then <reviewability_result>

      Examples:
        | presentation | reviewability_result |
        | a decision summary buried beneath step-by-step coding instructions and repeated test evidence | the plan fails focused reviewability |
        | an architecture-at-a-glance mental model followed by decision-bearing contracts, operational risks, and unresolved authority with supporting detail linked | the plan passes focused reviewability |
        | decision-bearing contracts, operational risks, and unresolved authority in the main review path but no architecture-at-a-glance mental model | the plan fails focused reviewability because it does not open with an architecture-at-a-glance mental model |
        | a short summary that opens with the architecture-at-a-glance mental model, names a load-bearing failure-posture decision and its consequence, and links only fuller subordinate detail | the plan passes focused reviewability because the decision remains in the main review path |
        | a short summary with a load-bearing failure-posture decision recorded nowhere in the plan or its linked detail | the plan fails focused reviewability because that decision is absent from the review path |

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
        | one persisted entity change that omits its purpose, store and model, and schema relationships | approval is blocked with the foundational data decisions named |
        | one persisted entity change that omits retention and rollback consequences | approval is blocked with retention and rollback named |
        | one persisted entity change that omits identity and integrity decisions | approval is blocked with identity and integrity named |
        | purpose, store and model, schema and relationships, source of truth, ownership and access, identity and integrity, cross-system flow, lifecycle and retention, migration and backfill, compliance, and rollback decisions recorded without migration commands | data guidance does not block approval |
        | a persisted cross-system flow with no source of truth or access decision | approval is blocked with source of truth and access named |
        | a regulated backfill with no compliance consequence | approval is blocked with compliance named |
        | no data-contract, ownership, or lifecycle impact | data guidance does not block approval |

    Scenario: Data decisions cannot be replaced by migration commands
      Given an Implementation Plan records every required data decision together with exact migration commands
      When the Implementation Plan is reviewed
      Then approval is blocked with the execution mechanics named for removal to Execution Planning

    Scenario: Conflicting data ownership blocks approval
      Given an Implementation Plan names a persisted entity owner that contradicts its source-of-truth authority
      When the Implementation Plan is reviewed
      Then approval is blocked with the conflicting data owner named

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

    @surface.safeword-cli
    Scenario Outline: Planning access permits only configured durable architecture records
      Given real project configuration resolves its durable architecture location as <architecture_location>
      When the installed Safeword planning edit gate evaluates <target_path> during Implementation Planning
      Then <edit_result>

      Examples:
        | architecture_location | target_path | edit_result |
        | one project-owned architecture file | that exact file | the architecture-record edit is permitted so a significant decision can be recorded before review |
        | one project-owned architecture file | a sibling file beside it | the edit remains blocked because resemblance does not grant planning access |
        | a project-owned ADR directory | a direct child named YYYYMMDD-slug.md | creation is permitted so a significant decision can be recorded before review |
        | a project-owned ADR directory | a direct child that does not match YYYYMMDD-slug.md | the edit remains blocked because directory membership alone does not make it an architecture record |
        | a project-owned ADR directory | a nested dated ADR below a child directory | the edit remains blocked because only direct dated ADR children are records |
        | a project-owned ADR directory | a dated ADR outside that directory | the edit remains blocked because the configured directory grants no access outside it |
        | one project-owned architecture file | an ordinary source path | the edit remains blocked by the planning freeze |

  @plan-implementability.TBU1.G1C9PP.R8
  Rule: plan-implementability.TBU1.G1C9PP.R8 — Architectural significance uses semantic triggers

    Scenario Outline: A one-file shared contract is significant while a many-file mechanical edit is not
      Given a one-file change <significant_change> and a many-file edit preserves every contract
      When architecture significance is evaluated
      Then the one-file change requires a durable architecture record and the mechanical edit does not

      Examples:
        | significant_change |
        | alters a shared API |
        | changes migration compatibility without altering a shared API |

  @plan-implementability.TBU1.G1C9PP.R9
  Rule: plan-implementability.TBU1.G1C9PP.R9 — One feature has one design plan of record

    Scenario Outline: One design plan remains the feature plan of record
      Given a feature needs component and data design detail with <artifact_state>
      When the Implementation Plan is reviewed
      Then <review_result>

      Examples:
        | artifact_state | review_result |
        | all decisions contained in the Implementation Plan | the receipt names it as the single design plan of record and requires no second design artifact |
        | all required decisions named with their consequence in the Implementation Plan and fuller detail linked as explicitly subordinate support | the receipt names the Implementation Plan as the single design plan of record and accepts the supporting link |
        | a linked document that claims independent feature-plan authority | approval is blocked until that authority returns to the Implementation Plan |
        | a linked document that carries a required decision the Implementation Plan does not name | approval is blocked until that required decision returns to the Implementation Plan |

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
        | unresolved rollout behavior | approval is blocked with rollout named as an Implementation Planning obligation |
        | resolved rollout behavior | rollout does not block approval |
        | unresolved proof scope | approval is blocked with proof scope named as an Implementation Planning obligation |
        | resolved proof scope | proof scope does not block approval |

    @surface.safeword-cli
    Scenario: Installed review reports every simultaneous decision blocker
      Given real project configuration, a plan with an unresolved API contract and unresolved rollback behavior, and a deterministic reviewer process result containing both findings
      When the installed Safeword CLI reviews the plan through real internal collaborators and the controlled reviewer process boundary
      Then the receipt names the API contract and rollback behavior without requiring an order

  @plan-implementability.TBU1.G1C9PP.R12
  Rule: plan-implementability.TBU1.G1C9PP.R12 — Load-bearing choices carry alternatives and evidence

    Scenario Outline: Decision evidence controls semantic review
      Given a load-bearing technology choice with a named evidence baseline has <evidence_state>
      When the Implementation Plan is reviewed
      Then <review_result>

      Examples:
        | evidence_state | review_result |
        | current evidence but neither a credible alternative nor a losing tradeoff | approval is blocked until the alternative and why it lost are explicit |
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
        | no decision entries and no skip | blocked by the structural check with the missing decision entry named |
        | an explicit no-load-bearing-choice skip contradicted by the plan's own load-bearing technology choice | blocked by semantic review before approval |
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
        | prose that omits the evidence reference and applicable version | blocked by the structural check with the missing evidence fields named |
        | prose that omits the retrieval date | blocked by the structural check with the missing retrieval date named |

  @plan-implementability.TBU1.G1C9PP.R14
  Rule: plan-implementability.TBU1.G1C9PP.R14 — Decision discovery is scope-bounded and covers the consequential trust, operation, approval, and recovery needs of every accepted persona

    Scenario Outline: Discovery respects and updates scope only with user authority
      Given discovery has surfaced an in-scope policy choice and an out-of-scope capability with <scope_decision>
      When Implementation Planning converges
      Then <scope_result>

      Examples:
        | scope_decision | scope_result |
        | no user-supplied scope-change approval | the capability remains outside the accepted plan |
        | fixture-minted typed scope-change authority bound to this ticket, session, and proposed scope | the capability enters this ticket's accepted consumer boundary |
        | only an agent-authored assertion with no externally supplied user authority | the capability remains outside the accepted plan |

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

    Scenario: Omitting one accepted persona blocks approach approval
      Given the accepted Product Plan includes a Technical Builder with an authorization-trust need and a Non-Technical Builder with a safe-recovery need, while the Implementation Plan covers only the Technical Builder's consequence
      When the Implementation Plan is reviewed
      Then approval is blocked with the omitted Non-Technical Builder and safe-recovery consequence named

  @plan-implementability.TBU1.G1C9PP.R15
  Rule: plan-implementability.TBU1.G1C9PP.R15 — Review receipts expose decision reviewability and concrete recovery

    Scenario Outline: The receipt records the focused-review judgment
      Given an Implementation Plan has <presentation>
      When its semantic review reaches a verdict
      Then the receipt records <receipt_result>

      Examples:
        | presentation | receipt_result |
        | a concise decision summary with named decisions and subordinate linked detail | a reviewability pass |
        | a decision summary buried beneath step-by-step execution detail | a reviewability failure naming the obscuring detail |

    @surface.safeword-cli
    Scenario: A blocked receipt gives a Non-Technical Builder a concrete recovery
      Given a failed review addressed to a Non-Technical Builder because a shared-contract choice has no durable architecture link
      When the installed Safeword CLI presents the review receipt through real internal collaborators
      Then its first user-visible sentence says the shared-contract choice needs an architecture record and its recovery line tells them to add that link before resubmitting, with neither line containing phase names, review identifiers, contract digests, or internal type names

    @surface.safeword-cli
    Scenario: A blocked receipt preserves evidence for a Technical Builder
      Given a failed review addressed to a Technical Builder because a shared-contract choice has no durable architecture link
      When the installed Safeword CLI presents the review receipt through real internal collaborators
      Then it preserves the failing check, Implementation Plan location, and durable-record obligation alongside the recovery

  @plan-implementability.TBU1.G1C9PP.R16
  Rule: plan-implementability.TBU1.G1C9PP.R16 — When planning and implementation states coexist, the plan distinguishes proposed decisions, implemented facts, available proof, known defects, and pending human authority without treating one as another

    Scenario Outline: Plan-state claims remain truthful
      Given an Implementation Plan is written after some implementation exists with <actual_state> and claims <plan_claim>
      When its decision review runs
      Then <review_result>

      Examples:
        | actual_state | plan_claim | review_result |
        | code exists without current-boundary proof | the behavior is implemented and proven | approval is blocked because implementation is presented as proof |
        | current-boundary proof exists but human approval is pending | the feature is approved to release | approval is blocked because proof is presented as human authority |
        | independent semantic review passed but configured human design approval was never requested | the approach is human-approved | approval is blocked because independent review is presented as human authority |
        | an implementation defect contradicts the proposed decision | the proposed decision, implemented behavior, known defect, and pending correction are labeled separately | state truthfulness does not block approval |
        | existing implementation covers another accepted behavior while this planned behavior is absent | the absent behavior's approach entry is labeled proposed rather than implemented | state truthfulness does not block approval |

  @plan-implementability.TBU1.G1C9PP.R17
  Rule: plan-implementability.TBU1.G1C9PP.R17 — Significant concurrency, security, durability, lifecycle, migration, and compatibility choices include the applicable state, authority, atomicity, retry, and evidence model at decision depth

    Scenario Outline: Significant workflow decisions are complete at decision depth
      Given an architecturally significant workflow changes <concern> and the Implementation Plan records <decision_detail>
      When the Implementation Plan is reviewed
      Then <review_result>

      Examples:
        | concern | decision_detail | review_result |
        | durable state | legal states, transitions, transition authority, atomicity boundary, retry behavior, and preserved evidence | decision depth does not block approval |
        | durable state | legal states, transitions, transition authority, atomicity boundary, and retry behavior but no preserved evidence | approval is blocked with the missing evidence model named |
        | authorization | permissions and the authority for every destructive transition | decision depth does not block approval |
        | authorization | permissions but no authority for a destructive transition | approval is blocked with the missing authority decision named |
        | concurrent state transition | transition states, authority, atomicity boundary, retry behavior, and preserved evidence | decision depth does not block approval |
        | concurrent state transition | transition states and authority but no atomicity boundary or retry behavior | approval is blocked with the missing concurrency decisions named |
        | lifecycle-scheduled deletion | deletion states, transition authority, atomicity, retry behavior, and preserved evidence | decision depth does not block approval |
        | lifecycle-scheduled deletion | deletion states, transition authority, atomicity, and retry behavior but no preserved evidence | approval is blocked with the missing lifecycle evidence model named |
        | migration | the target schema, crash boundary, retry behavior, and compatibility policy | decision depth does not block approval |
        | migration | the target schema but no crash, retry, or compatibility behavior | approval is blocked with the missing migration decisions named |
        | compatibility | supported-version states, change authority, atomic cutover boundary, retry behavior, and preserved interoperability evidence | decision depth does not block approval |
        | compatibility | supported-version states and change authority but no cutover boundary, retry behavior, or preserved interoperability evidence | approval is blocked with the missing compatibility decisions named |

  @plan-implementability.TBU1.G1C9PP.R18
  Rule: plan-implementability.TBU1.G1C9PP.R18 — Accepted quantitative promises carry a design-level measurement contract without moving Product-owned outcomes or Execution-owned instrumentation into the Implementation Plan

    Scenario Outline: Measurement ownership stays with the phase that owns it
      Given the Product Plan promises a measurable outcome for a named population and condition and the Implementation Plan <measurement_state>
      When the Implementation Plan is reviewed
      Then <review_result>

      Examples:
        | measurement_state | review_result |
        | decides the origin, method, validity safeguards, and failure behavior | measurement design does not block approval |
        | changes the promised target | approval is blocked because the Product-owned target was changed |
        | changes the affected population | approval is blocked because the Product-owned population was changed |
        | decides origin, method, validity safeguards, and failure behavior but also lists exact instrumentation commands | approval is blocked because instrumentation belongs in Execution Planning |
        | leaves validity safeguards unresolved without listing instrumentation commands | approval is blocked with the missing validity decision named |

    Scenario Outline: Measurement applicability is explicit
      Given the Product Plan makes no quantitative promise and the Implementation Plan <applicability_state>
      When the Implementation Plan is reviewed
      Then <review_result>

      Examples:
        | applicability_state | review_result |
        | records no measurement-design applicability decision | approval is blocked until measurement applicability is explicit |
        | records a bare applicability skip with no reason | approval is blocked until the measurement skip is justified |
        | records a justified measurement-design applicability skip | measurement design does not block approval |

  @plan-implementability.TBU1.G1C9PP.R19
  Rule: plan-implementability.TBU1.G1C9PP.R19 — The existing optional human design approval binds the exact semantically reviewed Implementation Plan before Execution Planning; unchanged approach bytes reuse that approval, changed approach bytes require a new decision, approval is not duplicated after the Execution Plan, headless work records pending authority without deadlocking or claiming approval, and the shared decision record preserves authority across concurrent writes, interruption, retry, contention, and compatible extensions

    @surface.safeword-cli
    Scenario Outline: Installed CLI human design authority follows configuration
      Given real project configuration sets human design approval to <approval_setting> for <invocation_context> and a deterministic reviewer process has approved the exact Implementation Plan
      When the installed Safeword CLI reaches the approval boundary through real internal collaborators
      Then <approval_result>

      Examples:
        | approval_setting | invocation_context | approval_result |
        | disabled | a non-interactive invocation | the CLI enters Execution Planning and records that human design approval was not required |
        | enabled | an interactive invocation with an approver available | the reviewed approach is presented once for that person's decision |
        | enabled | a non-interactive invocation with no approver available | the CLI invocation completes without requesting approver input, with the ticket still in Implementation Planning and approval recorded as pending |

    @surface.safeword-cli
    Scenario: A declined design returns to Implementation Planning
      Given human design approval is enabled and the approver declines the exact reviewed approach
      When the installed Safeword CLI records the decision through real internal collaborators
      Then the ticket remains in Implementation Planning with the declined approach named for repair

    @surface.safeword-cli
    Scenario: An accepted design enters Execution Planning
      Given human design approval is enabled and the approver accepts the exact reviewed approach
      When the installed Safeword CLI records the decision through real internal collaborators
      Then the approval is bound to those approach bytes and the ticket enters Execution Planning

    @surface.safeword-cli
    Scenario: A review-blocked design is never presented for human approval
      Given human design approval is enabled and semantic review has blocked the Implementation Plan with a named finding
      When the installed Safeword CLI reaches the approval boundary through real internal collaborators
      Then no human design decision is requested and the ticket remains in Implementation Planning with the blocking finding named

    @surface.safeword-cli
    Scenario Outline: Human design authority follows approach currency
      Given human design approval is enabled and the Implementation Plan bytes have <byte_change> since their approval
      When Execution Planning is requested through the installed Safeword CLI and real internal collaborators
      Then <approval_result>

      Examples:
        | byte_change | approval_result |
        | not changed | no further human decision is requested and Execution Planning proceeds on the existing approval |
        | changed | the current approach requires a new human decision |

    @surface.safeword-cli
    Scenario: Concurrent design decisions do not overwrite each other
      Given two distinct reviewed Implementation Plans have authorized design decisions writing concurrently to the same real project approval ledger
      When both installed Safeword CLI writers settle through real internal collaborators
      Then both exact-plan decisions are readable and neither append overwrites the other

    @surface.safeword-cli
    Scenario Outline: An interrupted approval resumes without duplicating authority
      Given an authorized approval write is interrupted <interruption_boundary> and that invocation exits
      When a fresh installed Safeword CLI invocation resumes the same ticket's approval through real internal collaborators
      Then exactly one current approval is recorded and Execution Planning begins without a second human decision

      Examples:
        | interruption_boundary |
        | before the decision event becomes durable |
        | after the decision event becomes durable but before the phase changes |

    @surface.safeword-cli
    Scenario: Approval-ledger contention fails closed without changing authority
      Given one writer holds the real project approval ledger while another authorized approval reaches its contention timeout
      When the second installed Safeword CLI invocation completes through real internal collaborators
      Then its ticket remains in Implementation Planning with approval pending and the ledger contains no approval for that plan

    @surface.safeword-cli
    Scenario: A design decision preserves compatible approval-ledger extensions
      Given the real project approval ledger contains a readable known event and an unknown compatible extension event
      When the installed Safeword CLI appends an authorized design approval through real internal collaborators
      Then the earlier known event remains readable, the unknown event bytes are unchanged, and the new exact-plan approval is current

    @surface.safeword-cli
    Scenario: A completed Execution Plan does not trigger a second design approval
      Given the reviewed approach already has its required human approval and the dependent Execution Plan is complete
      When implementation is requested through the installed Safeword CLI and real internal collaborators
      Then no second design approval is requested and implementation proceeds on the existing approach approval

    @surface.safeword-cli
    Scenario: A completed Execution Plan cannot preserve stale design approval
      Given human design approval is enabled, the dependent Execution Plan is complete, and the approach bytes changed after their prior human approval
      When implementation is requested through the installed Safeword CLI
      Then implementation remains blocked until a human makes a new decision on the current approach bytes

  @plan-implementability.TBU1.G1C9PP.R20
  Rule: plan-implementability.TBU1.G1C9PP.R20 — An incomplete or incorrect plan returns to decision discovery with the full current set of blocking defects and is corrected and re-reviewed on its new exact bytes until complete and correct or honestly waiting on an external decision

    @demo @surface.safeword-cli
    Scenario: Review repairs every known plan defect before execution planning
      Given real project configuration, an Implementation Plan with a missing authorization boundary, an incorrect data owner, and no rollback decision, and deterministic reviewer process results that return those findings then approve the corrected exact bytes
      When the installed Safeword CLI completes the review and repair loop through real internal collaborators and the controlled reviewer process boundary
      Then the first receipt names all three defects together and the approving receipt binds the corrected bytes rather than the original bytes and records no remaining blocking defect

    Scenario: External authority pauses repair without disguising the plan as complete
      Given a plan defect requires the user who owns scope and behavior to choose between two behaviorally different outcomes
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
