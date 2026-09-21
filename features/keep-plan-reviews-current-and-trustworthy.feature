Feature: Keep plan reviews current and trustworthy
  Safeword binds each planning approval to its canonical contract, exact plan, complete context, and honest reviewer route.
  # skip: Persona-specific wording for every fail-closed message introduced by R2-R6 and R9-R16 is owned and acceptance-tested by K3EBHB R7 and R10.
  # Every judged R7 and R10-R16 semantic-quality scenario uses fixed judge-model and rubric bytes, deterministic sampling settings, and three runs with at least two agreeing correct verdicts; below that threshold is inconclusive and cannot pass. They must not be implemented as structural text checks or mocked verdict echoes.

  @plan-implementability.TBU4.5F5ZZA.R1
  Rule: plan-implementability.TBU4.5F5ZZA.R1 — Shared clauses are authored once and generated into both contracts

    @surface.safeword-cli
    Scenario: Editing the canonical shared clause changes both generated phase contracts
      Given the canonical scope clause changed after both phase contracts were generated
      When the Safeword CLI reconciles the installed phase contracts through real project configuration
      Then both generated contracts contain the same changed clause and neither retains the old text

    @surface.safeword-cli
    Scenario: Phase-only clauses remain in their owning contract
      Given one clause belongs only to the Execution Plan contract and a different clause belongs only to the Implementation Plan contract
      When the Safeword CLI reconciles both installed phase contracts through real project configuration
      Then each clause appears only in its owning phase contract and neither appears in the other contract

    @surface.safeword-cli @rejection
    Scenario: A missing generated shared clause blocks reconciliation
      Given the contract generator omits a canonical shared clause from one expected phase-contract output
      When the Safeword CLI reconciles the installed phase contracts through real project configuration
      Then reconciliation is blocked with the missing shared clause and affected phase contract named

  @plan-implementability.TBU4.5F5ZZA.R2
  Rule: plan-implementability.TBU4.5F5ZZA.R2 — Each review receives its complete phase context

    Scenario Outline: A review packet cannot omit required phase context
      Given a <phase> review packet <packet_state>
      When review dispatch is prepared
      Then <dispatch_result>

      Examples:
        | phase | packet_state | dispatch_result |
        | Product Plan | omits one required current input | dispatch is blocked until that current context is included |
        | Product Plan | includes every required current phase input | dispatch proceeds to the semantic reviewer |
        | Implementation Plan | omits one required current input | dispatch is blocked until that current context is included |
        | Implementation Plan | includes every required current phase input | dispatch proceeds to the semantic reviewer |
        | Execution Plan | omits the accepted Implementation Plan | dispatch is blocked until that current context is included |
        | Execution Plan | includes every required current phase input, including the accepted Implementation Plan | dispatch proceeds to the semantic reviewer |
        | Implementation Plan | omits a conditionally required input whose trigger applies | dispatch is blocked until that current context is included |
        | Implementation Plan | omits a conditionally required input whose trigger does not apply and records the justified absence | dispatch proceeds to the semantic reviewer |
        | Implementation Plan | omits an optional supporting input while including every required input | dispatch proceeds to the semantic reviewer |

    @rejection
    Scenario Outline: Canonical phase entry requirements bind every required input
      Given the canonical <phase> contract requires <required_inventory> as review entry context
      When review dispatch receives a packet missing any listed required role
      Then dispatch is blocked with the missing role named

      Examples:
        | phase | required_inventory |
        | Product Plan | ticket, project, declared parent and milestone boundaries, Rules, epistemic state, principles, personas, and affected surfaces |
        | Implementation Plan | ticket, project, declared parent and milestone boundaries, Rules, scenarios, dimensions when present, principles, personas, affected surfaces, configured architecture records, and triggered data guidance |
        | Execution Plan | ticket, project, declared parent and milestone boundaries, Rules, scenarios, principles, personas, affected surfaces, and the accepted Implementation Plan |

    @surface.claude-code @rejection
    Scenario Outline: Installed dispatch cannot bypass packet completeness
      Given a <phase> review packet <packet_state>
      When actual lifecycle dispatch from installed local project hooks prepares the review with real configuration and collaborators, mocking only the reviewer process boundary
      Then <dispatch_result>

      Examples:
        | phase | packet_state | dispatch_result |
        | Implementation Plan | omits the current personas inventory | dispatch remains blocked until the current personas inventory is included |
        | Implementation Plan | includes the current personas inventory and every other required input | dispatch proceeds to the semantic reviewer |
        | Execution Plan | omits the accepted Implementation Plan | dispatch remains blocked until the accepted Implementation Plan is included |
        | Execution Plan | includes the accepted Implementation Plan and every other required input | dispatch proceeds to the semantic reviewer |

  @plan-implementability.TBU4.5F5ZZA.R3
  Rule: plan-implementability.TBU4.5F5ZZA.R3 — Required context resolves or fails closed

    Scenario Outline: Context resolution distinguishes defaults from broken overrides
      Given a planning phase has a required project-knowledge input that is <source_state>, where stale means its reconciliation lineage names a superseded packaged-source version
      When a plan review packet is resolved
      Then <resolution>

      Examples:
        | source_state | resolution |
        | not configured | the installed default is included |
        | configured and current with project-specific content absent from the installed default | the project source is included with that project-specific content |
        | configured but blank | dispatch is blocked with reconciliation named |
        | configured but unreadable | dispatch is blocked with reconciliation named |
        | configured but stale | dispatch is blocked with reconciliation named |
        | configured with only whitespace or comment changes | the project source is included and dispatch is not blocked |

    @surface.claude-code
    Scenario Outline: Local dispatch enforces required context resolution
      Given a planning phase with a current approving receipt has a required project-knowledge override that is <override_state>
      When actual lifecycle dispatch from installed local project hooks evaluates the phase transition with real configuration and collaborators, mocking only the reviewer process boundary
      Then <gate_result>

      Examples:
        | override_state | gate_result |
        | current and nonblank | the phase transition proceeds |
        | blank | the phase remains blocked with override reconciliation named |
        | stale because its reconciliation lineage names a superseded packaged-source version | the phase remains blocked with override reconciliation named |

  @plan-implementability.TBU4.5F5ZZA.R4
  Rule: plan-implementability.TBU4.5F5ZZA.R4 — Review provenance changes only for semantic dependencies

    Scenario Outline: Context identity ignores cosmetic and unrelated edits
      Given a plan has a current review recorded against its canonical phase contract, accepted scope, Rules, scenarios, plan decisions, applicable principles, applicable dimensions and data guidance, configured architecture records, and the project's surfaces and personas inventories
      When <context_change> occurs
      Then <review_state>

      Examples:
        | context_change | review_state |
        | a bound context artifact changes only in whitespace or comments | the review remains current |
        | the canonical phase contract changes only in whitespace or comments | the review remains current |
        | an unrelated persona or surface entry is added | the review remains current |
        | the reviewed plan changes only in whitespace or comments outside normalized Execution Plan checklist progress cells | that plan's review becomes stale because its exact bytes changed |
        | the canonical phase contract changes semantically | the review becomes stale |
        | a bound context artifact changes semantically | the review becomes stale |

  @plan-implementability.TBU4.5F5ZZA.R5
  Rule: plan-implementability.TBU4.5F5ZZA.R5 — Contract identity binds exact canonical bytes

    Scenario Outline: Installed contract identity controls authoring and approval
      Given <contract_copy_state>
      When the content identity of every generated contract copy is recomputed
      Then <gate_result>

      Examples:
        | contract_copy_state | gate_result |
        | the installed authoring contract deletes one clause but retains the canonical version label | authoring and approval are blocked until the exact canonical contract bytes are restored |
        | the installed authoring contract differs from the canonical source only in whitespace or comments | authoring and approval are blocked until the exact canonical contract bytes are restored |
        | the installed authoring contract is absent | authoring and approval are blocked until the canonical contract is restored |
        | the generated reviewer rubric deletes one clause but retains the canonical version label | review dispatch and approval are blocked until the exact canonical contract bytes are restored |
        | the authoring contract and reviewer rubric both match the exact canonical bytes | both copies recompute to the same identity and contract identity does not block authoring, dispatch, or approval |

    @surface.claude-code
    Scenario Outline: Local dispatch enforces canonical contract identity
      Given a planning phase with a current approving receipt has an installed authoring contract that <contract_state>
      When actual lifecycle dispatch from installed local project hooks evaluates the phase transition with real configuration and collaborators, mocking only the reviewer process boundary
      Then <gate_result>

      Examples:
        | contract_state | gate_result |
        | matches the exact canonical bytes | the phase transition proceeds |
        | deletes one clause but retains the canonical version label | the phase remains blocked with canonical contract reconciliation named |

    @surface.claude-code @rejection
    Scenario: Cosmetic canonical changes preserve review currency but require copy reconciliation
      Given a plan review is current and its canonical phase contract changed only in whitespace or comments after installed copies were generated
      When actual lifecycle dispatch from installed local project hooks evaluates the phase transition with real configuration and collaborators, mocking only the reviewer process boundary
      Then the review receipt remains current and the phase remains blocked with canonical contract reconciliation named

  @plan-implementability.TBU4.5F5ZZA.R6
  Rule: plan-implementability.TBU4.5F5ZZA.R6 — Review fallback is bounded and honestly labeled

    Scenario Outline: The review gate follows the typed route result
      Given the review coordinator has returned <route_result>
      When the phase gate evaluates the receipt
      Then <gate_result>

      Examples:
        | route_result | gate_result |
        | an independent reviewer approval | the review passes with cross-agent independence recorded |
        | every configured independent route was attempted and returned a typed failure, then the permitted fallback approves | the review passes with reduced independence and actual reviewer recorded without calling the capability degraded |
        | every independent route and same-agent headless review returned typed failures, then host-reported fresh-context review approves | the review passes with reduced independence and the host-reported fresh-context reviewer recorded |
        | every earlier route through host-reported fresh-context review returned typed failures, then bounded self-review approves | the review passes with reduced independence and the bounded self-reviewer recorded |
        | a typed retryable-route result naming another unattempted independent route | the phase remains blocked |
        | a pending review | the phase remains blocked |
        | an unrecognized or unparseable reviewer result | the phase remains blocked with no approval recorded |
        | an approval whose recorded origin is an ungated surface | the phase remains blocked with reviewer-route reconciliation named |
        | every configured independent route was attempted and returned a typed failure, then the permitted fallback declines | the phase remains blocked with no approval recorded |
        | a typed no-independent-route-attempted result | the phase remains blocked with reviewer-route reconciliation named |

    @rejection
    Scenario: Fallback cannot bypass an available independent route
      Given at least one independent reviewer route remains available and unattempted
      When the permitted fallback is requested
      Then fallback is refused and the phase remains blocked pending independent review

    Scenario Outline: Independent approval requires a genuinely independent reviewer
      Given an approval is returned by <reviewer_identity>
      When the coordinator classifies its independence
      Then <result>

      Examples:
        | reviewer_identity | result |
        | a different agent in a separate process using a model at least as capable as the author | cross-agent independence is accepted |
        | the authoring agent in the same process | independent approval is refused |
        | a different agent using a weaker model than the author | independent approval is refused |

    Scenario Outline: Route selection derives independence from configured model capability
      Given the real review route registry and project configuration select <reviewer_capability>
      When the coordinator selects an independent route while mocking only the agent invocation
      Then <selection_result>

      Examples:
        | reviewer_capability | selection_result |
        | a reviewer model at least as capable as the verified author model | that route is attempted as an independent review |
        | a reviewer model weaker than the verified author model | that route is not attempted as independent and selection continues to the next permitted route |

    Scenario Outline: Exhausted routes advance through the fallback ladder in order
      Given every route before <next_tier> was attempted and returned a typed failure
      When review recovery selects the next permitted route
      Then review recovery selects and attempts <next_tier>, and no later tier is attempted first

      Examples:
        | next_tier |
        | same-agent headless review |
        | host-reported fresh-context review |
        | bounded self-review |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Local phase gates enforce the real review result
      Given a planning phase on <local_host> through <installed_boundary> has <review_state>
      When actual lifecycle dispatch through <installed_boundary> evaluates the phase transition with real configuration and collaborators, mocking only the reviewer process boundary
      Then <gate_result>

      Examples:
        | local_host | installed_boundary | review_state | gate_result |
        | Claude Code | installed local project hooks | a pending review | the phase remains blocked |
        | Claude Code | installed local project hooks | a current approving receipt | the phase transition proceeds |
        | OpenAI Codex | installed Codex hooks | a pending review | the phase remains blocked |
        | OpenAI Codex | installed Codex hooks | a current approving receipt | the phase transition proceeds |
        | Cursor | installed Cursor hooks | a pending review | the phase remains blocked |
        | Cursor | installed Cursor hooks | a current approving receipt | the phase transition proceeds |
        | Claude Code | installed local project hooks | a permitted fallback approval after every configured independent route was attempted and returned a typed failure | the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded |
        | OpenAI Codex | installed Codex hooks | a permitted fallback approval after every configured independent route was attempted and returned a typed failure | the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded |
        | Cursor | installed Cursor hooks | a permitted fallback approval after every configured independent route was attempted and returned a typed failure | the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded |

    @surface.opencode
    Scenario Outline: OpenCode CLI and TUI gates enforce the real review result
      Given an OpenCode <entry_point> planning phase has <review_state>
      When actual lifecycle dispatch through the installed profile-level plugins/safeword.js evaluates the phase transition with real configuration and collaborators, mocking only the reviewer process boundary
      Then <gate_result>

      Examples:
        | entry_point | review_state | gate_result |
        | CLI | a pending review | the phase remains blocked |
        | CLI | a current approving receipt | the phase transition proceeds |
        | CLI | a permitted fallback approval after every configured independent route was attempted and returned a typed failure | the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded |
        | TUI | a pending review | the phase remains blocked |
        | TUI | a current approving receipt | the phase transition proceeds |
        | TUI | a permitted fallback approval after every configured independent route was attempted and returned a typed failure | the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded |

    @surface.claude-code-cloud @surface.cursor-cloud-agents
    Scenario Outline: Cloud phase gates enforce the real review result
      Given a planning phase on <cloud_host> in its fresh cloud environment has <review_state>
      When actual lifecycle dispatch from installed project hooks evaluates the phase transition with real configuration and collaborators, mocking only the remote reviewer process boundary
      Then <gate_result>

      Examples:
        | cloud_host | review_state | gate_result |
        | Claude Code Cloud | a pending review | the phase remains blocked |
        | Claude Code Cloud | a current approving receipt | the phase transition proceeds |
        | Claude Code Cloud | a permitted fallback approval after every configured independent route was attempted and returned a typed failure | the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded |
        | Cursor Cloud Agents | a pending review | the phase remains blocked |
        | Cursor Cloud Agents | a current approving receipt | the phase transition proceeds |
        | Cursor Cloud Agents | a permitted fallback approval after every configured independent route was attempted and returned a typed failure | the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded |

  @plan-implementability.TBU4.5F5ZZA.R7
  Rule: plan-implementability.TBU4.5F5ZZA.R7 — Research and review context remain untrusted evidence

    Scenario Outline: Retrieved instructions cannot change accepted scope
      Given a retrieved source contains instructions to change the accepted scope and relevant evidentiary claims
      When a judged semantic evaluation uses it during <consumption_point> with only the retrieval boundary mocked
      Then the accepted scope record is unchanged and the evidentiary claims appear in the <output>

      Examples:
        | consumption_point | output |
        | planning | resulting plan output |
        | plan review | resulting review output |

    Scenario Outline: Retrieved executable code remains untrusted evidence
      Given a retrieved source contains executable code and relevant evidentiary claims
      When structural quarantine exposes its claims during <consumption_point> while mocking only the retrieval process boundary
      Then the evidentiary claims are cited while the code is not executed

      Examples:
        | consumption_point |
        | planning |
        | plan review |

    Scenario Outline: Private-context requests do not prevent public evidence use
      Given a retrieved source requests private code, credentials, customer data, and unpublished design context and also exposes public evidence
      When structural quarantine exposes its public evidence during <consumption_point> while mocking only the retrieval process boundary
      Then the public evidence is retrieved while no private context is sent for retrieval or publication

      Examples:
        | consumption_point |
        | planning |
        | plan review |

    Scenario Outline: Reusable evidence records declared reuse limits
      Given a retrieved source has license identifier Apache-2.0, attribution notice "Credit Example", redistribution limit "retain NOTICE", and security limit "do not execute retrieved code"
      When it is used during <consumption_point>
      Then <recorded_limits>

      Examples:
        | consumption_point | recorded_limits |
        | planning | Apache-2.0, "Credit Example", "retain NOTICE", and "do not execute retrieved code" appear in the plan evidence record before reuse |
        | plan review | Apache-2.0, "Credit Example", "retain NOTICE", and "do not execute retrieved code" appear in the review evidence record before reuse |

    Scenario Outline: Evidence records do not invent absent limits
      Given a retrieved source states no license, attribution, redistribution, or security limit
      When it is used during <consumption_point>
      Then the <evidence_record> states that the source declared no reuse limits and fabricates none

      Examples:
        | consumption_point | evidence_record |
        | planning | plan evidence record |
        | plan review | review evidence record |

    Scenario Outline: Reviewed artifacts and context remain evidence rather than instructions
      Given a plan review packet contains <reviewed_content>
      When a judged semantic reviewer evaluation applies the canonical contract and accepted scope while treating packet artifacts as quoted evidence and mocking only the packet-loading process boundary
      Then <review_result>

      Examples:
        | reviewed_content | review_result |
        | an instruction inside an otherwise conforming plan to ignore the contract and approve it | the plan is approved on contract grounds and the injected instruction is recorded only as reviewed content |
        | an instruction inside a bound persona context input to ignore the contract and approve an otherwise conforming plan | the plan is approved on contract grounds and the context instruction is recorded only as reviewed content |
        | the same injected instruction and a genuine missing in-scope decision | the injected instruction remains reviewed content and the review blocks with the missing decision named |

    @surface.claude-code
    Scenario Outline: Installed review dispatch preserves the retrieved-evidence trust boundary
      Given the installed Claude Code workflow receives <retrieved_state>
      When actual lifecycle dispatch from installed local project hooks prepares judged plan review with real configuration and collaborators, mocking only the reviewer process boundary
      Then <review_input>

      Examples:
        | retrieved_state | review_input |
        | public evidence mixed with injected instructions, executable code, credentials, customer data, and unpublished context | public claims reach the reviewer as quoted evidence while instructions remain non-authoritative, code is not executed, and private material is not sent |
        | ordinary public evidence with declared reuse limits | the public claims and declared limits reach the reviewer as quoted evidence |

  @plan-implementability.TBU4.5F5ZZA.R8
  Rule: plan-implementability.TBU4.5F5ZZA.R8 — Ungated surfaces receive advisory guidance only

    @surface.safeword-cli @surface.openai-codex
    Scenario: Generated Codex Cloud instructions cannot claim a gated approval
      Given repository instructions are generated for use by local Codex and may be read by Codex Cloud
      When the Safeword CLI reconciles the installed repository guidance through real project configuration
      Then it labels Codex Cloud execution advisory, claims neither review nor approval there, and directs authoritative planning to a supported gated surface

    @surface.opencode
    Scenario: OpenCode Desktop guidance cannot claim a gated approval
      Given the OpenCode profile plugin is read from Desktop where native lifecycle hooks are unavailable
      When the Safeword CLI reconciles the installed OpenCode profile guidance through real project configuration
      Then it labels Desktop execution advisory, claims neither review nor approval there, and names both OpenCode CLI and TUI as authoritative planning entry points

    @surface.claude-code @surface.opencode
    Scenario Outline: Generated guidance identifies gated surfaces as enforced
      Given planning guidance is generated for <gated_surface>
      When the Safeword CLI reconciles that installed guidance through real project configuration
      Then it states that planning review and approval are enforced there and does not label that surface advisory

      Examples:
        | gated_surface |
        | local Claude Code |
        | OpenCode CLI |

  @plan-implementability.TBU4.5F5ZZA.R9
  Rule: plan-implementability.TBU4.5F5ZZA.R9 — Review invalidation follows the dependency direction specified by the Execution Planning contract; this child implements the shared provenance and invalidation mechanics rather than defining a second dependency matrix

    Scenario Outline: A declared change invalidates exactly its dependent reviews
      Given both plans have current review receipts
      When <change_description> occurs
      Then <invalidated_reviews>

      Examples:
        | change_description | invalidated_reviews |
        | accepted behavior | both plan reviews are invalidated |
        | accepted scope | both plan reviews are invalidated |
        | only the accepted Implementation Plan's formatting bytes | only the Implementation Plan review is invalidated and the Execution Plan review remains current |
        | only the Execution Plan bytes, including formatting-only bytes outside normalized checklist progress cells | only the Execution Plan review is invalidated |
        | only whitespace inside a reviewed Execution Plan checklist row's normalized progress cells | neither plan review is invalidated |
        | only ordinary progress in a reviewed Execution Plan checklist row's Disposition, Evidence class, Revision, or final evidence cell | neither plan review is invalidated |

    Scenario Outline: Invalidation follows the canonical Execution Planning dependency direction
      Given current plan-review receipts and a canonical Execution Planning contract that declares <dependency_direction>
      When the accepted Implementation Plan changes semantically
      Then <invalidation_result>

      Examples:
        | dependency_direction | invalidation_result |
        | accepted Implementation Plan changes invalidate both plan reviews | both plan reviews are invalidated |
        | accepted Implementation Plan changes invalidate only their own review | only the Implementation Plan review is invalidated and the Execution Plan review remains current |

    @rejection
    Scenario Outline: An approving receipt is valid only for its own ticket and review kind
      Given the Execution Plan gate receives <receipt_identity>
      When the gate validates receipt provenance
      Then <gate_result>

      Examples:
        | receipt_identity | gate_result |
        | an Execution Plan approval for the current ticket and exact current plan bytes | the matching receipt does not block the phase transition |
        | an Implementation Plan approval for the current ticket and same plan bytes | the phase remains blocked with the mismatched review kind and re-review named |
        | an Execution Plan approval for a sibling ticket and same plan bytes | the phase remains blocked with the mismatched ticket and re-review named |

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode @surface.claude-code-cloud @surface.cursor-cloud-agents
    Scenario Outline: Installed phase gates enforce invalidated review receipts
      Given a planning phase on <host_entry> has an approving receipt invalidated by a changed accepted scenario
      When actual lifecycle dispatch through <installed_boundary> evaluates the phase transition with real configuration and collaborators, mocking only the reviewer process boundary
      Then the phase remains blocked with re-review named

      Examples:
        | host_entry | installed_boundary |
        | Claude Code | installed local project hooks |
        | OpenAI Codex | installed Codex hooks |
        | Cursor | installed Cursor hooks |
        | OpenCode CLI | installed profile-level plugins/safeword.js |
        | OpenCode TUI | installed profile-level plugins/safeword.js |
        | Claude Code Cloud | installed project hooks in its fresh cloud environment |
        | Cursor Cloud Agents | installed project hooks in its fresh cloud environment |

  @plan-implementability.TBU4.5F5ZZA.R10
  Rule: plan-implementability.TBU4.5F5ZZA.R10 — Product, Implementation, and Execution Planning contracts share one explicit contract shape while each approval remains limited to its own behavioral, design, or delivery claim

    Scenario Outline: Each planning contract declares its bounded decision
      Given the canonical <artifact> contract is presented
      When a judged semantic reviewer evaluation checks its completeness against the canonical contract-shape rubric
      Then it declares purpose, entry requirements, required and prohibited content, its review question, approval meaning, invalidating changes, and return path and limits approval to <approved_claim>

      Examples:
        | artifact | approved_claim |
        | Product Plan/spec | the right complete behavior for accepted personas |
        | Implementation Plan | the accepted coherent implementation design |
        | Execution Plan | startable and provable delivery of the accepted design |

    @rejection
    Scenario Outline: An incomplete planning contract cannot pass completeness checking
      Given a canonical planning contract omits <required_element>
      When a judged semantic reviewer evaluation checks its completeness against the canonical contract-shape rubric
      Then the contract is rejected with the missing <required_element> named

      Examples:
        | required_element |
        | its review question |
        | prohibited content |
        | its return path |

    @rejection
    Scenario Outline: A planning approval cannot claim its downstream state
      Given <artifact> has passed its own review
      When a judged semantic reviewer evaluation checks a receipt that claims <downstream_state>
      Then the receipt is rejected with the unsupported downstream claim named

      Examples:
        | artifact | downstream_state |
        | Product Plan/spec | technical feasibility and approved design |
        | Implementation Plan | completed implementation and release approval |
        | Execution Plan | passed verification and merge authority |

    Scenario: A planning approval may claim its own bounded state
      Given an Implementation Plan has passed its own review
      When a judged semantic reviewer evaluation checks a receipt claiming only the accepted coherent implementation design
      Then the receipt is accepted as a bounded Implementation Plan approval

  @plan-implementability.TBU4.5F5ZZA.R11
  Rule: plan-implementability.TBU4.5F5ZZA.R11 — Blocking findings cite accepted requirements and expose defects or unresolved choices without letting reviewer-authored product or architecture decisions, optional strengthening, or corrected-but-unreviewed bytes pass as approved

    @rejection
    Scenario Outline: Finding authority controls whether a review may block
      Given a recorded planning-review finding of <finding>
      When a judged semantic reviewer evaluation applies the canonical finding-authority rubric against the accepted contract and scope
      Then <result>

      Examples:
        | finding | result |
        | a requirement accepted upstream is unmet | the review blocks with the violated Rule, defect, unresolved choice, and constraints named |
        | an optional resilience improvement outside accepted scope | the suggestion remains nonblocking until the user accepts it |
        | a replacement architecture selected only by the reviewer | the reviewer-authored decision is recorded as a nonblocking suggestion and the review does not block on it |
        | a uniquely determined correction under an accepted decision | the review blocks with the uniquely determined correction named |

    @surface.claude-code @rejection
    Scenario Outline: The installed Implementation Plan gate enforces finding authority
      Given an Implementation Plan in the installed Claude Code workflow <contract_state>
      When actual lifecycle dispatch from installed local project hooks runs its judged Implementation Plan review with real configuration and collaborators, mocking only non-reviewer process boundaries
      Then <gate_result>

      Examples:
        | contract_state | gate_result |
        | satisfies every requirement accepted upstream | Implementation Plan approval proceeds |
        | leaves a requirement accepted upstream unmet | Implementation Plan approval remains blocked with the violated Rule and unmet requirement named |

    @rejection
    Scenario: Corrected plan bytes cannot inherit the prior verdict
      Given a review blocked on a uniquely determined correction under an accepted decision
      When the correction changes the plan bytes without a fresh review
      Then the corrected plan remains blocked until a verdict is recorded against those exact bytes

    Scenario: A fresh verdict can clear the corrected-plan block
      Given corrected plan bytes have a fresh approving verdict recorded against those exact bytes
      When the phase gate reevaluates the prior correction block
      Then the prior block is cleared and that correction no longer prevents the phase transition

  @plan-implementability.TBU4.5F5ZZA.R12
  Rule: plan-implementability.TBU4.5F5ZZA.R12 — Accepted scope combines ticket, project, milestone, and inherited parent boundaries

    @rejection
    Scenario Outline: No binding scope source can be omitted from review
      Given a child plan is bound by ticket scope, ticket exclusions, project non-goals, milestone non-goals, and inherited parent boundaries and its review packet includes every structurally required role and path but <context_state>
      When a judged semantic reviewer evaluation applies the canonical accepted-boundary completeness rubric to the packet
      Then <result>

      Examples:
        | context_state | result |
        | preserves every binding boundary in those supplied sources | missing boundary context does not block review dispatch or approval |
        | the supplied ticket context omits its positive scope | review cannot approve and names the missing ticket scope |
        | the supplied ticket context omits its exclusions | review cannot approve and names the missing ticket boundary |
        | the supplied project context omits its non-goals | review cannot approve and names the missing project boundary |
        | the supplied milestone context omits its non-goals | review cannot approve and names the missing milestone boundary |
        | the supplied parent context omits its inherited boundary | review cannot approve and names the unchecked inherited boundary |

    @surface.claude-code @rejection
    Scenario Outline: The installed Implementation Plan gate enforces binding scope context
      Given an Implementation Plan in the installed Claude Code workflow has a review packet that <context_state>
      When actual lifecycle dispatch from installed local project hooks runs its judged Implementation Plan review with real configuration and collaborators, mocking only non-reviewer process boundaries
      Then <gate_result>

      Examples:
        | context_state | gate_result |
        | contains every binding scope source | Implementation Plan review dispatch proceeds |
        | omits the project non-goals | Implementation Plan approval remains blocked with the missing project boundary named |

  @plan-implementability.TBU4.5F5ZZA.R13
  Rule: plan-implementability.TBU4.5F5ZZA.R13 — Completeness checks both omissions and overreach against that accepted boundary

    Scenario Outline: Plan completeness is bidirectional
      Given an accepted boundary requires authorization and excludes automatic account migration and the plan <plan_state>
      When a judged semantic reviewer evaluation applies the canonical bidirectional scope-completeness rubric to the plan
      Then <result>

      Examples:
        | plan_state | result |
        | omits authorization behavior | approval is blocked with the in-scope omission named |
        | includes automatic account migration | approval is blocked with the out-of-scope proposal named |
        | decides authorization and excludes account migration | scope completeness does not block approval |

    @surface.claude-code @rejection
    Scenario Outline: The installed Implementation Plan gate enforces bidirectional scope completeness
      Given an Implementation Plan in the installed Claude Code workflow <plan_state>
      When actual lifecycle dispatch from installed local project hooks runs its judged Implementation Plan review with real configuration and collaborators, mocking only non-reviewer process boundaries
      Then <gate_result>

      Examples:
        | plan_state | gate_result |
        | covers every accepted behavior without adding excluded behavior | Implementation Plan approval proceeds |
        | omits an accepted behavior | Implementation Plan approval remains blocked with the omission named |
        | adds an excluded behavior | Implementation Plan approval remains blocked with the overreach named |

  @plan-implementability.TBU4.5F5ZZA.R14
  Rule: plan-implementability.TBU4.5F5ZZA.R14 — Reviewer corrections cannot silently expand accepted scope, and declined optional strengthening remains declined and reviewable

    Scenario Outline: Optional strengthening changes only through user authority
      Given a nonblocking reviewer suggestion for a useful capability outside the accepted boundary is recorded
      When the user <scope_decision>
      Then <result>

      Examples:
        | scope_decision | result |
        | declines it | the unchanged plan is re-reviewed against the accepted boundary and the decline remains recorded |
        | accepts it | the expansion is recorded as user-accepted before the plan is corrected and re-reviewed |

    Scenario: An undecided optional suggestion cannot alter or block the plan
      Given a nonblocking suggestion outside the accepted boundary awaits a user decision
      When the unchanged plan is re-reviewed while that decision remains outstanding
      Then the reviewed plan bytes remain unchanged, the gate does not block on or silently add the suggestion, and the outstanding choice is re-presented for the user to decide

    @surface.claude-code
    Scenario: Installed re-review retains a declined optional strengthening
      Given the user recorded a decline for an optional strengthening under the current accepted boundary and left the plan unchanged
      When a later judged re-review runs through installed local project hooks with real configuration and collaborators, mocking only non-reviewer process boundaries
      Then the decline is supplied to the reviewer, the suggestion remains nonblocking, and any approval is recorded against the unchanged plan bytes

  @plan-implementability.TBU4.5F5ZZA.R15
  Rule: plan-implementability.TBU4.5F5ZZA.R15 — Architecture, data, testing, domain, research, and reviewer guidance supplies candidate decisions rather than authority to expand accepted scope

    Scenario Outline: Guidance respects the accepted boundary
      Given a recorded architecture, data, testing, domain, or research suggestion proposes <candidate>
      When a judged semantic reviewer evaluation applies the canonical accepted-boundary guidance rubric to the suggestion
      Then <result>

      Examples:
        | candidate | result |
        | a decision required by accepted behavior | the decision is surfaced and resolved in its owning plan |
        | an unrelated capability whose exclusion does not change the accepted outcome | the capability is dropped |
        | a capability outside accepted behavior whose exclusion would change the accepted outcome | the capability is surfaced as a user-owned scope choice and does not enter the plan |

  @plan-implementability.TBU4.5F5ZZA.R16
  Rule: plan-implementability.TBU4.5F5ZZA.R16 — The Product Plan contract inventories or explicitly excludes every accepted persona's consequential success, refusal, failure, approval, trust, and recovery outcomes and keeps known facts, assumptions, and unresolved product decisions visibly distinct; scenario review separately proves coverage of every applicable outcome

    @rejection
    Scenario Outline: Product Plan approval requires every accepted persona outcome
      Given the Product Plan accepts a Technical Builder and a Non-Technical Builder and <outcome_inventory_state>
      When a judged semantic reviewer evaluation applies the canonical Product Plan completeness rubric
      Then <review_result>

      Examples:
        | outcome_inventory_state | review_result |
        | inventories every accepted persona's consequential success, refusal, failure, approval, trust, and recovery outcomes | persona-outcome completeness does not block Product Plan approval |
        | marks the Non-Technical Builder's approval outcome explicitly inapplicable with a stated reason and inventories the rest | persona-outcome completeness does not block Product Plan approval |
        | omits the Non-Technical Builder's recovery outcome | Product Plan approval is blocked naming that missing recovery outcome and reports no scenario-coverage verdict |

    @rejection
    Scenario Outline: Product Plan approval requires honest epistemic status
      Given the Product Plan contains known facts, assumptions, and unresolved product decisions and <epistemic_state>
      When a judged semantic reviewer evaluation applies the canonical Product Plan completeness rubric
      Then <review_result>

      Examples:
        | epistemic_state | review_result |
        | presents an assumption as a known fact | Product Plan approval is blocked with the epistemic-status defect named |
        | keeps known facts, assumptions, and unresolved product decisions distinct | epistemic status does not block Product Plan approval |

    @rejection
    Scenario Outline: Scenario review proves every applicable persona outcome
      Given an approved Product Plan persona-outcome inventory <coverage_state>
      When the scenario gate evaluates behavior coverage
      Then <gate_result>

      Examples:
        | coverage_state | gate_result |
        | has at least one accepted scenario for every applicable outcome | scenario coverage does not block approval |
        | has no accepted scenario for the Non-Technical Builder recovery outcome | scenario approval is blocked with that uncovered recovery outcome named |

    @surface.claude-code
    Scenario Outline: The installed Product Plan gate enforces persona-outcome completeness
      Given a Product Plan in the installed Claude Code workflow <inventory_state>
      When actual lifecycle dispatch from installed local project hooks runs its judged Product Plan review with real configuration and collaborators, mocking only non-reviewer process boundaries
      Then <gate_result>

      Examples:
        | inventory_state | gate_result |
        | inventories every accepted persona's consequential outcomes | Product Plan approval proceeds |
        | omits the Non-Technical Builder's recovery outcome | Product Plan approval remains blocked with the missing persona outcome named |
