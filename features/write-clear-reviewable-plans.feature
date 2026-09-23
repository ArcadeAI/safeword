Feature: Make Safeword plans clear and reviewable
  Plan authors and reviewers use one portable writing standard and one shared way to settle decisions.

  @plan-implementability.TBU4.ZSHVEB.R1
  Rule: plan-implementability.TBU4.ZSHVEB.R1 — One shared writing guide is complete and reviewable

    @surface.safeword-cli
    Scenario: Installation preserves the approved writing guide
      Given a package contains a canonical guide with all six required writing topics
      When Safeword installs and reconciles a project through its CLI
      Then the installed guide is byte-identical to the canonical guide

    Scenario: A complete writing guide passes its content contract
      Given all six required topics have active Weak, Strong, and Source examples and at least one Source has an inline HTTPS citation
      When Safeword checks the writing-guide contract
      Then the guide passes

    Scenario: Reconciliation repairs a divergent writing guide
      Given a project's installed writing guide differs from the canonical guide
      When Safeword installs and reconciles that project through its CLI
      Then the installed guide is byte-identical to the canonical guide

    @rejection
    Scenario Outline: An incomplete or extra topic fails the writing-guide contract
      Given the canonical guide has <defect>
      When Safeword checks the writing-guide contract
      Then the guide is rejected with the affected topic named

      Examples:
        | defect |
        | a required topic without active Weak, Strong, and Source examples |
        | a seventh writing topic with its own examples |

    @rejection
    Scenario: Markers hidden in a comment cannot complete a writing topic
      Given a required writing topic's Weak, Strong, and Source markers appear only in an HTML comment
      When Safeword checks the writing-guide contract
      Then the guide is rejected with that topic named

    @rejection
    Scenario: An unsupported citation fails guide review
      Given a writing topic cites a source that does not support its load-bearing claim
      When the guide receives source-aware semantic review
      Then the guide is rejected with the unsupported claim named

    @rejection
    Scenario: Source prose cannot replace a qualifying citation
      Given all six writing topics have active Weak, Strong, and Source markers but no Source contains an inline HTTPS citation
      When Safeword checks the writing-guide contract
      Then the guide is rejected with the missing citation named

  @plan-implementability.TBU4.ZSHVEB.R2
  Rule: plan-implementability.TBU4.ZSHVEB.R2 — Product Plan versions remain complete and compatible

    @surface.safeword-cli
    Scenario: A fresh parent Product Plan uses the complete v2 contract
      Given Safeword is authoring a fresh parent Product Plan
      When the plan is created and reviewed through the CLI contract
      Then its ticket and spec have matching v2 markers and every required product field is authored in that plan

    @rejection
    Scenario: Matching v2 markers cannot hide a missing product field
      Given a Product Plan instance has matching v2 markers but lacks Launch communication
      When Safeword validates that instance under the v2 Product Plan contract
      Then review fails with the missing field named while its Product Plan class and v2 identity remain unchanged

    Scenario: A fresh child keeps parent-owned fields by reference
      Given Safeword is authoring a fresh child contribution under an accepted v2 parent
      When the child is created and reviewed through the CLI contract
      Then child-owned fields are authored in the child and parent-owned fields resolve through its accepted parent reference and digest without restating parent content

    @rejection
    Scenario: A well-formed stale parent digest cannot validate a v2 child
      Given a v2 child's recorded parent_contract_digest is 64 lowercase hexadecimal characters but differs from its accepted parent's job-scoped digest
      When Safeword resolves the child for review
      Then review fails with the stale parent digest named and reconciling the child to its accepted parent as recovery

    @rejection
    Scenario Outline: Partial or ambiguous ticket pairs have named recoveries
      Given a tracked ticket directory has <pair_state>
      When Safeword classifies it before Product Plan version resolution
      Then it returns <result> and names <recovery>

      Examples:
        | pair_state | result | recovery |
        | a lone spec | incomplete-pair | restoring the tracked ticket or removing the orphan |
        | a ticket whose sibling spec was deleted | incomplete-pair | restoring the tracked spec or removing the orphan |
        | structure matching multiple ticket classes | ambiguous | restoring a recognized non-Product shape or owner-authorized v2 migration |

    Scenario: A recognized non-Product ticket stays outside Product Planning
      Given a lone tracked non-Product ticket has rename-aware history proving it never had a spec
      When Safeword classifies it before Product Plan version resolution
      Then it returns not-a-product-plan and leaves that ticket on its own contract

    @rejection
    Scenario Outline: Product Plan sources reject project-specific requirements
      Given one canonical Product Plan template, author/review contract, or shared decision source contains <project_specific_content>
      When Safeword checks every canonical Product Plan source for portability
      Then the source containing the project-specific content is rejected with that content named

      Examples:
        | project_specific_content |
        | an Arcade identifier |
        | a company-specific approval ceremony without a prohibited name |

    @rejection
    Scenario: Product Plan fields cannot be supplied by another canonical file
      Given a canonical Product Plan source omits a required field that another canonical source contains
      When Safeword checks the v2 Product Plan contract
      Then the contract fails with the deficient source and field named

    @rejection
    Scenario: A commented Product Plan field is not authored
      Given a required field marker appears only in an HTML comment in one canonical Product Plan source
      When Safeword checks the v2 Product Plan contract
      Then the contract fails with that source and field named

    Scenario: Complete v1 plans remain valid without rewriting them
      Given a complete accepted v1 child has matching markers and references a valid v1 parent
      When Safeword validates it under the version-selected contract
      Then it remains v1 with its accepted content and parent digest unchanged

    @rejection
    Scenario: Only a proven transition-era pair permits a matching v1 marker repair
      Given a spec-v1 Product Plan lacks its ticket marker and full history proves first coexistence in the pinned transition window
      When Safeword resolves its contract version before review
      Then it blocks with v1-ticket-marker-repair-required and names restoring only the matching v1 ticket marker

    @rejection
    Scenario: The same marker gap outside the transition window requires v2 migration
      Given a spec-v1 Product Plan lacks its ticket marker and full history proves first coexistence outside the pinned transition window
      When Safeword resolves its contract version before review
      Then it blocks until the owner authorizes v2 migration and current-contract review

    @rejection
    Scenario Outline: Other invalid Product Plan identities require v2 migration
      Given a Product Plan has <marker_state>
      When Safeword resolves its contract version before review
      Then it blocks until the owner authorizes v2 migration and current-contract review

      Examples:
        | marker_state |
        | a ticket-only v1 marker |
        | conflicting ticket and spec versions |
        | an unknown marker version |

    @rejection
    Scenario: A child cannot inherit from a schema-incomplete parent
      Given an implementing child has complete v2 markers and a receipt but its referenced v2 parent lacks Launch communication
      When Safeword resolves the child for review
      Then it returns invalid-parent-contract without continuation and names completing the parent before child reconciliation

    @rejection
    Scenario Outline: A v1 child cannot newly enter planning under a v2 parent
      Given a <child_state> v1 child references a valid v2 parent without an active continuation receipt
      When Safeword resolves the child for review
      Then it returns child-version-migration-required and names owner-authorized v2 child migration and current-contract review

      Examples:
        | child_state |
        | fresh |
        | returned |

    @rejection
    Scenario: A new child cannot proceed under an unversioned parent
      Given a new child references a legacy-unversioned parent
      When Safeword resolves the child for review
      Then it returns legacy-parent-blocked and names migrating the parent to v2 before child reconciliation

    @rejection
    Scenario: A missing frontmatter parent blocks child review
      Given a child's ticket frontmatter names a parent with no tracked ticket directory
      When Safeword resolves the child for review
      Then it returns parent-not-found and names correcting the reference or restoring the tracked parent

    @rejection
    Scenario: A receipt cannot continue work after its parent disappears
      Given an implementing child has a previously valid continuation receipt but its frontmatter parent no longer resolves
      When Safeword resolves the child for continued work
      Then it blocks with parent-not-found and names correcting the reference or restoring the tracked parent

    @rejection
    Scenario: A spec cannot override the frontmatter parent
      Given a child's spec Parent entry disagrees with its ticket frontmatter under a schema-valid Product Plan parent
      When Safeword resolves the child for review
      Then it returns child-parent-reference-invalid and names reconciling the spec reference to frontmatter

    Scenario: A v2 child names absent v1 concepts
      Given a complete v1 parent lacks a persona outcome inventory and launch communication
      When Safeword reviews a v2 child against that parent
      Then the child maps available parent fields and marks only those two absent concepts as unavailable in v1

    @rejection
    Scenario: A child cannot hide a field its parent supplies
      Given a v1 parent has a persona outcome inventory
      When its v2 child claims that inventory is unavailable in v1
      Then the child fails review with the omitted parent field named

    Scenario: A parent migration preserves bound child meaning
      Given an implementing v1 child has an accepted continuation receipt and its parent gains only v2 fields without changing a bound concept
      When Safeword resolves the child after the authorized parent migration
      Then the child continues under its receipt without claiming v2 approval

    Scenario: A valid implementing child gets a latent receipt before parent migration
      Given an implementing v1 child and its parent are valid under v1 with qualifying evidence at the consumer-local cutoff
      When Safeword first encounters the v2 planning contract before any parent migration
      Then ordinary v1 admission succeeds and a latent receipt binds the pre-migration parent digest and normalized projection
      And tracked ticket, spec, and plan bytes remain unchanged

    @rejection
    Scenario: Changing bound parent meaning ends child continuation
      Given an implementing child has an accepted continuation receipt and its parent changes a Rule the child references
      When Safeword resolves the child against the changed parent
      Then continuation is refused with the child's base contract result and a return to planning

    @rejection
    Scenario: Missing history cannot manufacture a continuation receipt
      Given an implementing legacy feature needs a continuation receipt but its checkout lacks required history
      When Safeword resolves its Product Plan contract
      Then it mints no receipt, returns planning-history-unavailable, preserves existing evidence, and names a full-history checkout as recovery

    @rejection
    Scenario: Branch-only phase history cannot mint a continuation receipt
      Given an implementing legacy Product Plan's matching blob and phase commit exist only on the caller's branch after the consumer default-branch cutoff, without an accepted review receipt
      When Safeword first encounters the v2 planning contract
      Then it mints no receipt and returns legacy-unversioned with owner-authorized v2 migration and current review as recovery

    Scenario: A branch-only accepted review can mint a continuation receipt
      Given an implementing legacy Product Plan has an accepted content-addressed review receipt on the caller's branch matching its current plan bytes
      When Safeword first encounters the v2 planning contract
      Then it mints a receipt bound to that review id and artifact digest and allows in-flight continuation

    @rejection
    Scenario: Changed Product Plan bytes cannot mint a continuation receipt
      Given an implementing legacy Product Plan differs from its matching historical blob and accepted review digest
      When Safeword first encounters the v2 planning contract
      Then it mints no receipt and returns legacy-unversioned with owner-authorized v2 migration and current review as recovery

    @rejection
    Scenario: Planning cannot mint a receipt before activation is declared
      Given a checkout lacks the planning-contract activation manifest declaration
      When Safeword evaluates a new Product Planning gate
      Then it returns planning-contract-activation-unavailable without minting a receipt and names checking out the declaration commit or a descendant

    @rejection
    Scenario Outline: Invalid activation history blocks release
      Given a release candidate has <activation_defect>
      When Safeword checks planning-contract activation history
      Then release is blocked with the invalid activation identity named

      Examples:
        | activation_defect |
        | a declaration SHA different from the computed activation commit |
        | an activation commit whose first parent already contains the new planning gates |
        | a release containing the activation commit but not its declaration commit |

    @rejection
    Scenario: A stale transition-history pin blocks release
      Given a pinned Product Plan transition commit does not add its expected artifact relative to its first parent
      When Safeword checks the pinned transition history for release
      Then release is blocked until the pin is corrected and independently re-reviewed

    @rejection
    Scenario: Returning to planning ends legacy continuation
      Given an implementing feature continued under its accepted legacy plan
      When a changed product decision returns it to Product Planning
      Then its continuation receipt is cleared and the base contract result requires current Product Planning and review

  @plan-implementability.TBU4.ZSHVEB.R3
  Rule: plan-implementability.TBU4.ZSHVEB.R3 — Implementation Plans decide design without sequencing work

    @surface.safeword-cli
    Scenario: The current design contract retains its decision and proof obligations
      Given accepted scenarios require architecture, interface, data, release, and proof choices
      When the Implementation Plan is authored and reviewed under the current contract
      Then it covers the thirteen required fields and retains decision evidence, applicability, proof scope, and confidence limits

    @rejection
    Scenario Outline: Implementation Plan sources reject project-specific requirements
      Given one Implementation Plan template, author contract, or evaluated rubric contains <project_specific_content>
      When Safeword checks every canonical Implementation Plan source for portability
      Then the source containing the project-specific content is rejected with that content named

      Examples:
        | project_specific_content |
        | an Arcade identifier |
        | a company-specific approval ceremony without a prohibited name |

    @rejection
    Scenario: Rubric fields cannot satisfy the author-facing Implementation Plan contract
      Given all thirteen required fields appear only inside the Implementation Plan rubric block
      When Safeword checks the author-facing region outside that block
      Then the contract fails with the deficient author-facing region named

    @rejection
    Scenario Outline: Execution fields cannot satisfy Implementation Planning
      Given an otherwise complete Implementation Plan adds an active <execution_field> field
      When the plan receives decision-focused review
      Then it is returned for moving that field to Execution Planning

      Examples:
        | execution_field |
        | Build order |
        | Commands to run |
        | Current proof results |

    Scenario: A CLI command contract remains in the Implementation Plan
      Given an otherwise complete Implementation Plan has an API-contract heading named Commands exposed by the CLI
      When the plan receives decision-focused review
      Then it passes the execution-field contract with that heading retained

    Scenario: Accepted legacy implementation keeps its exact design authority
      Given a feature is implementing an accepted legacy Implementation Plan with bound unchanged content
      When Safeword encounters the expanded design contract
      Then it continues under recorded legacy authority without a false current-contract approval

    @rejection
    Scenario: Changed legacy plan bytes cannot continue by phase alone
      Given a feature is implementing but its legacy Implementation Plan bytes differ from the bound evidence
      When Safeword encounters the expanded design contract
      Then it returns implementation-plan-continuation-unavailable and names returning to Implementation Planning for current-contract review

    @rejection
    Scenario: Returning to design requires current review
      Given a feature continued under an accepted legacy Implementation Plan
      When a new design choice returns it to Implementation Planning
      Then the preserved plan becomes a draft that needs current-contract review

    Scenario: An existing synthetic plan passes the adoption-instance contract
      Given an existing synthetic Implementation Plan has all thirteen decision fields and no execution fields
      When Safeword checks it in adoption-instance mode
      Then the plan satisfies the same required and forbidden field contract as a fresh plan

    @rejection
    Scenario: Adoption-instance mode rejects a missing design field
      Given an existing synthetic Implementation Plan lacks a required decision field
      When Safeword checks it in adoption-instance mode
      Then it returns implementation-plan-contract-invalid with the missing field named

    @rejection
    Scenario: Adoption-instance mode rejects execution sequencing
      Given an existing synthetic Implementation Plan has all required fields but adds Build order
      When Safeword checks it in adoption-instance mode
      Then it returns implementation-plan-contract-invalid with the execution field named

  @plan-implementability.TBU4.ZSHVEB.R4
  Rule: plan-implementability.TBU4.ZSHVEB.R4 — Markdown work receives the guide at the right boundary

    @rejection
    Scenario Outline: An unclassified or ambiguous Markdown path stops dispatch
      Given a discovered Markdown path <classification_defect>
      When Safeword classifies it before model dispatch
      Then it returns writing-target-classification-invalid and names correcting the schema or manifest declaration

      Examples:
        | classification_defect |
        | matches no declared path class |
        | matches two declared path classes |

    Scenario: Project plans and tickets remain data rather than workflow instructions
      Given a registered semantic-review request targets a tracked Markdown spec and reads tracked ticket and plan files
      When Safeword prepares that request
      Then those project-instance files carry no instruction role or load directive of their own
      And the request binds the exact installed writing guide for its Markdown target

    @rejection
    Scenario: An instruction role on project-instance data fails before dispatch
      Given a tracked ticket is project-instance data but a request assigns it an authoring instruction role
      When Safeword prepares the model request
      Then it returns writing-context-polarity-invalid and names rebuilding through the registered role

    @surface.safeword-cli
    Scenario Outline: Model work binds the guide only for Markdown targets
      Given a registered <work_kind> request has <target_kind> targets
      When Safeword prepares its model request from declared targets
      Then the request <guide_result> the exact installed writing guide

      Examples:
        | work_kind | target_kind | guide_result |
        | authoring | Markdown | includes |
        | semantic review | mixed Markdown and non-Markdown | includes |
        | hybrid | Markdown | includes |
        | authoring | a tracked spec declared Markdown project-instance data | includes |
        | authoring | non-Markdown | omits |
        | authoring | declared Markdown content at an identity without a .md suffix | includes |
        | authoring | a .md-suffixed target declared non-Markdown | omits |
        | pure execution | Markdown | omits |
        | structural parsing | Markdown | omits |

    @rejection
    Scenario: A caller cannot suppress a declared Markdown target
      Given a registered authoring request declares a Markdown target
      When its caller supplies an empty target set instead
      Then Safeword refuses model dispatch with writing-target-set-invalid and names correcting the registered request mapping

    @rejection
    Scenario: A registered request without targets cannot dispatch
      Given a registered authoring request derives no targets from its typed request
      When Safeword prepares that model request
      Then it refuses dispatch with writing-target-set-invalid and names correcting the registered request mapping

    @rejection
    Scenario: A missing installed guide stops Markdown authoring
      Given a registered authoring request declares a Markdown target but the installed writing guide is absent
      When Safeword prepares the model request
      Then it refuses dispatch with writing-guide-reconciliation-required and names reconciling from the shipped package

    @rejection
    Scenario: A mismatched package guide digest stops Markdown authoring
      Given the shipped package's recorded guide digest differs from its canonical guide bytes
      When Safeword prepares a Markdown authoring request
      Then it refuses dispatch with writing-guide-reconciliation-required and names reconciling from the shipped package

    @rejection
    Scenario: A stale installed guide stops dispatch
      Given a Markdown authoring request was prepared with a guide that changed before dispatch
      When Safeword tries to send that request
      Then it refuses dispatch with prepared-writing-context-stale and names preparation again after reconciliation

    Scenario: Markdown authoring resumes after guide reconciliation
      Given a project's divergent writing guide was reconciled to the canonical guide
      When Safeword prepares a registered Markdown authoring request again
      Then the request dispatches with the exact installed writing guide bound

    @rejection
    Scenario: An unregistered model transport cannot bypass the writing boundary
      Given a model-capable transport has no registered role or audited construction path
      When Safeword checks the dispatch inventory
      Then it returns model-transport-unregistered and names registration through the audited boundary as recovery

    Scenario: Workflow sources carry the directive according to role
      Given canonical Markdown sources include authoring, semantic-review, hybrid, execution, parser, and non-workflow roles
      When Safeword checks their active instructions
      Then every authoring, semantic-review, and hybrid source carries the operative writing-guide directive while execution, parser, and non-workflow sources do not

    @rejection
    Scenario: A plan contract cannot copy a writing lesson from the guide
      Given a canonical plan artifact repeats a guide topic with its own Weak and Strong writing examples
      When Safeword checks canonical plans and contracts for duplicated writing guidance
      Then the artifact fails with the copied writing lesson named

    Scenario: Domain examples do not count as copied writing guidance
      Given a plan contract uses Weak and Strong labels for a domain example and a separate Source label for decision evidence
      When Safeword checks it for duplicated writing guidance
      Then the duplication check accepts that plan contract

    Scenario: Failure recovery inventory has one action per distinct result
      Given Product Plan, Implementation Plan, and writing-context failure fixtures name their typed results and reasons
      When Safeword generates the recovery inventory
      Then every named fixture result-and-reason pair appears in the inventory with exactly one owner-facing recovery and owning rule

    @rejection
    Scenario: A missing fixture result fails recovery-inventory generation
      Given a Product Plan failure fixture names a typed result and reason absent from the recovery inventory
      When Safeword checks the inventory against its failure fixtures
      Then inventory generation fails with the missing result-and-reason pair named

    @rejection
    Scenario: A declared result without a failure fixture fails recovery-inventory generation
      Given a Product Plan contract declares a typed failure result that no failure fixture names
      When Safeword checks the contract against its recovery fixtures
      Then inventory generation fails with the unproven result named

    @rejection
    Scenario: A guide mention inside an example cannot satisfy the directive
      Given an authoring workflow mentions the guide only inside a comment or example
      When Safeword checks its writing-guide dependency
      Then the workflow fails with the missing operative directive named

  @plan-implementability.TBU4.ZSHVEB.R5
  Rule: plan-implementability.TBU4.ZSHVEB.R5 — The writing guide stays portable

    @surface.safeword-cli
    Scenario: A general writing guide works without a project-specific service
      Given the guide states portable writing advice with suitable primary sources
      When Safeword installs and reviews it without external tracker configuration
      Then installation and review pass without reading a project-owned document or making an outbound citation request

    @rejection
    Scenario: Project-specific writing guidance is rejected
      Given the guide requires a company-specific approval ceremony
      When Safeword checks its portability
      Then the guide is rejected with the offending content named

  @plan-implementability.TBU4.ZSHVEB.R6
  Rule: plan-implementability.TBU4.ZSHVEB.R6 — Product and Implementation Planning share one decision conversation

    @surface.safeword-cli
    Scenario: Both stages resolve one authoritative conversation source
      Given Product and Implementation Planning declare their own checkpoint topics
      When Safeword checks their conversation dependencies
      Then both stages resolve the same current interaction contract without a stage-specific copy

    @rejection
    Scenario: A stage-specific conversation fork fails contract proof
      Given Implementation Planning carries interaction rules that differ from the shared contract
      When Safeword checks the two planning stages
      Then the planning contract is rejected with the divergent stage named

    @surface.safeword-cli
    Scenario Outline: Both planning stages use the same decision-conversation contract
      Given the shared contract governs <stage> with its own checkpoint topics and plan artifact
      When Safeword begins a decision checkpoint in <stage>
      Then it presents researched facts, assumptions, unknowns, a recommendation, alternatives, tradeoffs, and the proposed plan record before one closing question

      Examples:
        | stage |
        | Product Planning |
        | Implementation Planning |

    @rejection
    Scenario: An item-by-item questionnaire cannot replace a complete decision set
      Given a planning transcript asks approval for related choices one field at a time before presenting their alternatives
      When Safeword reviews the transcript against the shared decision-conversation contract
      Then the transcript is rejected without an approval or completed plan record

    @rejection
    Scenario: Approval waits for the complete decision set
      Given a proposed checkpoint omits its viable alternatives, tradeoffs, and plan record
      When Safeword checks the checkpoint before requesting confirmation
      Then confirmation is withheld until the complete decision set is presented

    Scenario: User-only knowledge rejoins the current checkpoint
      Given a complete proposed decision set exposes one fact only the user can supply
      When the user supplies that fact after Safeword asks for it
      Then Safeword re-presents one reconciled decision set before requesting confirmation

    Scenario Outline: Each decision is recorded in its owning plan
      Given the user <disposition> a proposed <decision_kind> decision
      When Safeword records the checkpoint outcome
      Then <owning_plan> records the choice, reason, and consequence as <recorded_state>

      Examples:
        | disposition | decision_kind | owning_plan | recorded_state |
        | accepts | product | the Product Plan section it shapes | accepted |
        | rejects | product | the Product Plan section it shapes | rejected |
        | leaves unresolved | product | Unresolved product decisions | pending with an owner |
        | accepts | design | Recorded Decisions in the Implementation Plan | accepted |
        | rejects | design | Approaches considered in the Implementation Plan | rejected |
        | leaves unresolved | design | Approval state in the Implementation Plan | pending with an owner |

    @rejection
    Scenario: Chat-only agreement cannot complete a checkpoint
      Given a user confirms a design choice in chat but the Implementation Plan has no durable record
      When Safeword tries to approve the Implementation Plan
      Then approval is refused until the choice and consequence are recorded in that plan

    Scenario: Autonomous confirmation still records the decision
      Given a planning checkpoint may be confirmed without a user reply under accepted authority
      When Safeword confirms its complete decision set
      Then the owning plan records the accepted choice and rejected alternatives with reasons

    Scenario: Resume repeats the current decision set without restarting discovery
      Given planning stops after presenting a checkpoint but before its confirmation
      When Safeword resumes that planning stage
      Then it re-presents the current decision set and preserves earlier recorded choices

    Scenario Outline: A changed decision returns to the earliest affected plan
      Given implementation discovers <change_kind> after accepted planning
      When Safeword reconciles the decision before continuing work
      Then <return_path> while still-valid completed work and proof remain available

      Examples:
        | change_kind | return_path |
        | a changed product outcome | the Product Plan and affected scenarios are reconfirmed before both downstream plans are refreshed |
        | a changed design contract | the Implementation Plan is re-reviewed before the Execution Plan is refreshed |
        | a changed task order | only the Execution Plan is refreshed and re-reviewed |

    @rejection
    Scenario: A changed Product decision cannot leave downstream approval current
      Given a Product outcome changes after the Implementation and Execution Plans were approved
      When Safeword attempts to continue implementation without refreshing those plans
      Then continuation is refused until affected scenarios and both dependent plans are current

    @rejection
    Scenario: Planning cannot demand a fifth substantive checkpoint
      Given a planning transcript has four completed checkpoints and proposes a fifth approval for remaining related decisions
      When Safeword reviews the transcript against the shared decision-conversation contract
      Then the fifth approval is rejected and the remaining decisions stay within the existing checkpoints
