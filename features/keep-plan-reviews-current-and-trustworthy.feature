Feature: Keep plan reviews current and trustworthy
  Safeword binds each planning approval to its canonical contract, exact plan, complete context, and honest reviewer route.

  @plan-implementability.TBU4.5F5ZZA.R1
  Rule: plan-implementability.TBU4.5F5ZZA.R1 — Shared clauses are authored once and generated into both contracts

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    @rejection
    Scenario: Editing the canonical shared clause changes both generated phase contracts
      Given both phase contracts were generated from one canonical scope clause
      When that canonical clause is changed and generation runs
      Then both generated contracts contain the same changed clause and neither retains the old text

  @plan-implementability.TBU4.5F5ZZA.R2
  Rule: plan-implementability.TBU4.5F5ZZA.R2 — Each review receives its complete phase context

    Scenario Outline: A review packet cannot omit required phase context
      Given a plan review packet <packet_state>
      When review dispatch is prepared
      Then <dispatch_result>

      Examples:
        | packet_state | dispatch_result |
        | omits the nonblank ticket boundary | dispatch is blocked until that current context is included |
        | omits current spec Rules | dispatch is blocked until that current context is included |
        | omits accepted scenarios | dispatch is blocked until that current context is included |
        | omits the canonical phase contract | dispatch is blocked until that current context is included |
        | omits the plan under review | dispatch is blocked until that current context is included |
        | omits resolved principles, personas, and surfaces | dispatch is blocked until that current context is included |
        | omits required current dimensions | dispatch is blocked until that current context is included |
        | omits applicable data guidance and configured architecture records | dispatch is blocked until that current context is included |
        | omits the accepted Implementation Plan for Execution Plan review | dispatch is blocked until that current context is included |
        | includes every required current phase input | dispatch proceeds to the semantic reviewer |

  @plan-implementability.TBU4.5F5ZZA.R3
  Rule: plan-implementability.TBU4.5F5ZZA.R3 — Required context resolves or fails closed

    @rejection
    Scenario Outline: Context resolution distinguishes defaults from broken overrides
      Given a required project-knowledge input is <source_state>
      When a plan review packet is resolved
      Then <resolution>

      Examples:
        | source_state | resolution |
        | not configured | the installed default is included |
        | configured and current | the project source is included |
        | configured but blank | dispatch is blocked with reconciliation named |
        | configured but unreadable | dispatch is blocked with reconciliation named |
        | configured but stale | dispatch is blocked with reconciliation named |

  @plan-implementability.TBU4.5F5ZZA.R4
  Rule: plan-implementability.TBU4.5F5ZZA.R4 — Review provenance changes only for semantic dependencies

    @rejection
    Scenario Outline: Context identity ignores cosmetic and unrelated edits
      Given a plan has a current review bound to ticket-relevant normalized context
      When <context_change> occurs
      Then <review_state>

      Examples:
        | context_change | review_state |
        | whitespace or comments change | the review remains current |
        | an unrelated surface entry is added | the review remains current |
        | accepted ticket scope or a current Rule changes | the review becomes stale |
        | an accepted scenario or referenced persona changes | the review becomes stale |
        | an accepted plan decision changes | the review becomes stale |
        | an applicable principle or affected surface changes | the review becomes stale |

  @plan-implementability.TBU4.5F5ZZA.R5
  Rule: plan-implementability.TBU4.5F5ZZA.R5 — Contract identity binds exact canonical bytes

    Scenario Outline: Installed contract identity controls authoring and approval
      Given the installed authoring contract <contract_state>
      When its content identity is recomputed
      Then <gate_result>

      Examples:
        | contract_state | gate_result |
        | deletes one clause but retains the canonical version label | authoring and approval are blocked until the exact canonical contract bytes are restored |
        | is absent | authoring and approval are blocked until the canonical contract is restored |
        | matches the exact canonical bytes | contract identity does not block authoring or approval |

  @plan-implementability.TBU4.5F5ZZA.R6
  Rule: plan-implementability.TBU4.5F5ZZA.R6 — Review fallback is bounded and honestly labeled

    Scenario Outline: The review gate follows the typed route result
      Given the review coordinator reports <route_result>
      When the phase gate evaluates the receipt
      Then <gate_result>

      Examples:
        | route_result | gate_result |
        | an independent reviewer approval | the review passes with cross-agent independence recorded |
        | every independent route exhausted and the permitted fallback approves | the review passes with reduced independence and actual reviewer recorded |
        | authentication failure | the phase remains blocked |
        | a pending review | the phase remains blocked |
        | a fallback attempt while an independent reviewer route remains available | fallback is refused and the phase remains blocked pending independent review |
        | every independent route exhausted and the permitted fallback declines | the phase remains blocked with no approval recorded |

    @surface.claude-code-cloud @surface.cursor-cloud-agents
    Scenario Outline: Cloud phase gates enforce the real review result
      Given a planning phase on <cloud_host> has <review_state>
      When <cloud_entry> evaluates the phase transition
      Then <gate_result>

      Examples:
        | cloud_host | cloud_entry | review_state | gate_result |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM | a pending review | the phase remains blocked |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM | a current approving receipt | the phase transition proceeds |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner | a pending review | the phase remains blocked |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner | a current approving receipt | the phase transition proceeds |

  @plan-implementability.TBU4.5F5ZZA.R7
  Rule: plan-implementability.TBU4.5F5ZZA.R7 — Research and review context remain untrusted evidence

    Scenario Outline: Retrieved instructions cannot change accepted scope
      Given a retrieved source contains instructions to change the accepted scope and relevant evidentiary claims
      When it is used during <consumption_point>
      Then the accepted scope record is unchanged and the evidentiary claims appear in the resulting plan or review output

      Examples:
        | consumption_point |
        | planning |
        | plan review |

    Scenario Outline: Retrieved executable code remains untrusted evidence
      Given a retrieved source contains executable code and relevant evidentiary claims
      When it is used during <consumption_point>
      Then the evidentiary claims are cited while the code is not executed

      Examples:
        | consumption_point |
        | planning |
        | plan review |

    Scenario Outline: Private-context requests do not prevent public evidence use
      Given a retrieved source requests private unpublished context and also exposes public evidence
      When it is used during <consumption_point>
      Then the public evidence is retrieved while no private context is sent for retrieval or publication

      Examples:
        | consumption_point |
        | planning |
        | plan review |

    Scenario Outline: Reusable evidence records license and security limits
      Given a retrieved source is reusable subject to license and security limits
      When it is used during <consumption_point>
      Then those limits are recorded before reuse

      Examples:
        | consumption_point |
        | planning |
        | plan review |

  @plan-implementability.TBU4.5F5ZZA.R8
  Rule: plan-implementability.TBU4.5F5ZZA.R8 — Ungated surfaces receive advisory guidance only

    @rejection @surface.safeword-cli @surface.openai-codex
    Scenario: Generated Codex Cloud instructions cannot claim a gated approval
      Given repository instructions are generated for use by local Codex and may be read by Codex Cloud
      When the generated guidance describes the two planning phases
      Then it labels Codex Cloud execution advisory, claims neither review nor approval there, and directs authoritative planning to a supported gated surface

  @plan-implementability.TBU4.5F5ZZA.R9
  Rule: plan-implementability.TBU4.5F5ZZA.R9 — Review invalidation follows dependency direction

    @rejection
    Scenario Outline: A changed artifact invalidates exactly its dependent reviews
      Given both plans have current review receipts
      When <changed_input> changes semantically
      Then <invalidated_reviews>

      Examples:
        | changed_input | invalidated_reviews |
        | accepted behavior or scope | both plan reviews are invalidated |
        | the accepted Implementation Plan | both plan reviews are invalidated |
        | only the Execution Plan | only the Execution Plan review is invalidated |
        | unrelated formatting in shared context | neither plan review is invalidated |
