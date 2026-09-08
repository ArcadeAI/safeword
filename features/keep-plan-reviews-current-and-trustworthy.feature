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

    @rejection
    Scenario: Execution Plan review includes the accepted approach in addition to feature context
      Given an Execution Plan and complete feature context exist but the accepted Implementation Plan is omitted from the review packet
      When review dispatch is prepared
      Then dispatch is blocked until the accepted Implementation Plan is included

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
        | configured but blank, unreadable, or stale | dispatch is blocked with reconciliation named |

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
        | an applicable principle or affected surface changes | the review becomes stale |

  @plan-implementability.TBU4.5F5ZZA.R5
  Rule: plan-implementability.TBU4.5F5ZZA.R5 — Contract identity binds exact canonical bytes

    @rejection
    Scenario: Same-version contract editing fails the digest gate
      Given an installed authoring contract deletes one clause but retains the canonical version label
      When its content identity is recomputed
      Then authoring and approval are blocked until the exact canonical contract bytes are restored

  @plan-implementability.TBU4.5F5ZZA.R6
  Rule: plan-implementability.TBU4.5F5ZZA.R6 — Review fallback is bounded and honestly labeled

    @rejection
    Scenario Outline: The review gate follows the typed route result
      Given the review coordinator reports <route_result>
      When the phase gate evaluates the receipt
      Then <gate_result>

      Examples:
        | route_result | gate_result |
        | an independent reviewer approval | the review passes with cross-agent independence recorded |
        | every independent route exhausted and the permitted fallback approves | the review passes with reduced independence and actual reviewer recorded |
        | authentication failure or a pending review | the phase remains blocked |

  @plan-implementability.TBU4.5F5ZZA.R7
  Rule: plan-implementability.TBU4.5F5ZZA.R7 — Research and review context remain untrusted evidence

    @rejection
    Scenario Outline: Untrusted evidence cannot cross its authority boundary
      Given a retrieved source contains <hazard>
      When it is used during planning or review
      Then <safe_outcome>

      Examples:
        | hazard | safe_outcome |
        | instructions to change the accepted scope | the instructions are ignored and only evidentiary claims are considered |
        | executable code | the code is not executed |
        | a request for private unpublished context | no private context is sent for retrieval or publication |
        | a reusable source with license and security limits | those limits are recorded before reuse |

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
