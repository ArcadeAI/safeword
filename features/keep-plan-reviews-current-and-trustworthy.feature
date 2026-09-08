Feature: Keep plan reviews current and trustworthy
  Safeword binds each planning approval to its canonical contract, exact plan, complete context, and honest reviewer route.

  @plan-implementability.TBU4.5F5ZZA.R1
  Rule: plan-implementability.TBU4.5F5ZZA.R1 — Shared clauses are authored once and generated into both contracts

    @surface.safeword-cli
    Scenario: Editing the canonical shared clause changes both generated phase contracts
      Given both phase contracts were generated from one canonical scope clause
      When that canonical clause is changed and generation runs
      Then both generated contracts contain the same changed clause and neither retains the old text

  @plan-implementability.TBU4.5F5ZZA.R2
  Rule: plan-implementability.TBU4.5F5ZZA.R2 — Each review receives its complete phase context

    Scenario Outline: A review packet cannot omit required phase context
      Given a <phase> review packet <packet_state>
      When review dispatch is prepared
      Then <dispatch_result>

      Examples:
        | phase | packet_state | dispatch_result |
        | Implementation Plan | omits the ticket boundary | dispatch is blocked until that current context is included |
        | Implementation Plan | omits accepted behavior artifacts | dispatch is blocked until that current context is included |
        | Implementation Plan | omits the canonical phase contract | dispatch is blocked until that current context is included |
        | Implementation Plan | omits the plan under review | dispatch is blocked until that current context is included |
        | Implementation Plan | omits resolved project knowledge, including applicable dimensions and guidance | dispatch is blocked until that current context is included |
        | Implementation Plan | includes every required current phase input | dispatch proceeds to the semantic reviewer |
        | Execution Plan | omits the accepted Implementation Plan | dispatch is blocked until that current context is included |
        | Execution Plan | includes every required current phase input, including the accepted Implementation Plan | dispatch proceeds to the semantic reviewer |

  @plan-implementability.TBU4.5F5ZZA.R3
  Rule: plan-implementability.TBU4.5F5ZZA.R3 — Required context resolves or fails closed

    Scenario Outline: Context resolution distinguishes defaults from broken overrides
      Given a required project-knowledge input is <source_state>, where stale means the source changed semantically since the review was recorded
      When a plan review packet is resolved
      Then <resolution>

      Examples:
        | source_state | resolution |
        | not configured | the installed default is included |
        | configured and current | the project source is included |
        | configured but blank | dispatch is blocked with reconciliation named |
        | configured but unreadable | dispatch is blocked with reconciliation named |
        | configured but stale | dispatch is blocked with reconciliation named |
        | configured with only whitespace or comment changes | the project source is included and dispatch is not blocked |

    @surface.safeword-cli @surface.claude-code
    Scenario Outline: Local dispatch enforces required context resolution
      Given a planning phase with a current approving receipt has a required project-knowledge override that is <override_state>
      When actual lifecycle dispatch from installed local project hooks evaluates the phase transition with real configuration and collaborators, mocking only the reviewer process boundary
      Then <gate_result>

      Examples:
        | override_state | gate_result |
        | current and nonblank | the phase transition proceeds |
        | blank | the phase remains blocked with override reconciliation named |
        | stale because it changed semantically since the review was recorded | the phase remains blocked with override reconciliation named |

  @plan-implementability.TBU4.5F5ZZA.R4
  Rule: plan-implementability.TBU4.5F5ZZA.R4 — Review provenance changes only for semantic dependencies

    Scenario Outline: Context identity ignores cosmetic and unrelated edits
      Given a plan has a current review bound to normalized context whose relevance is limited to the ticket's affected surfaces and referenced personas
      When <context_change> occurs
      Then <review_state>

      Examples:
        | context_change | review_state |
        | whitespace or comments change | the review remains current |
        | an unrelated surface entry is added | the review remains current |
        | accepted ticket scope changes | the review becomes stale |
        | a current Rule changes | the review becomes stale |
        | an accepted scenario changes | the review becomes stale |
        | a referenced persona changes | the review becomes stale |
        | an accepted plan decision changes | the review becomes stale |
        | an applicable principle changes | the review becomes stale |
        | an affected surface changes | the review becomes stale |

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

    @surface.safeword-cli @surface.claude-code
    Scenario Outline: Local dispatch enforces canonical contract identity
      Given a planning phase with a current approving receipt has an installed authoring contract that <contract_state>
      When actual lifecycle dispatch from installed local project hooks evaluates the phase transition with real configuration and collaborators, mocking only the reviewer process boundary
      Then <gate_result>

      Examples:
        | contract_state | gate_result |
        | matches the exact canonical bytes | the phase transition proceeds |
        | deletes one clause but retains the canonical version label | the phase remains blocked with canonical contract reconciliation named |

  @plan-implementability.TBU4.5F5ZZA.R6
  Rule: plan-implementability.TBU4.5F5ZZA.R6 — Review fallback is bounded and honestly labeled

    Scenario Outline: The review gate follows the typed route result
      Given the review coordinator reports <route_result>
      When the phase gate evaluates the receipt
      Then <gate_result>

      Examples:
        | route_result | gate_result |
        | an independent reviewer approval | the review passes with cross-agent independence recorded |
        | every configured independent route was attempted and returned a typed failure, then the permitted fallback approves | the review passes with reduced independence and actual reviewer recorded without calling the capability degraded |
        | authentication failure | the phase remains blocked |
        | reviewer timeout | the phase remains blocked |
        | reviewer network partition | the phase remains blocked |
        | a pending review | the phase remains blocked |
        | an unrecognized or unparseable reviewer result | the phase remains blocked with no approval recorded |
        | an approval whose recorded origin is an ungated surface | the phase remains blocked with reviewer-route reconciliation named |
        | every configured independent route was attempted and returned a typed failure, then the permitted fallback declines | the phase remains blocked with no approval recorded |
        | zero independent routes are configured or reachable before any attempt | the phase remains blocked with reviewer-route reconciliation named |

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

    Scenario Outline: Exhausted routes advance through the fallback ladder in order
      Given every route before <next_tier> was attempted and returned a typed failure
      When review recovery selects the next permitted route
      Then <next_tier> is attempted before any later tier

      Examples:
        | next_tier |
        | same-agent headless review |
        | host-reported fresh-context review |
        | bounded self-review |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Local phase gates enforce the real review result
      Given a planning phase on <local_host> has <review_state>
      When actual lifecycle dispatch from installed local project hooks evaluates the phase transition with real configuration and collaborators, mocking only the reviewer process boundary
      Then <gate_result>

      Examples:
        | local_host | review_state | gate_result |
        | Claude Code | a pending review | the phase remains blocked |
        | Claude Code | a current approving receipt | the phase transition proceeds |
        | Claude Code | an approving receipt invalidated by a changed accepted scenario | the phase remains blocked with re-review named |
        | OpenAI Codex | a pending review | the phase remains blocked |
        | OpenAI Codex | a current approving receipt | the phase transition proceeds |
        | Cursor | a pending review | the phase remains blocked |
        | Cursor | a current approving receipt | the phase transition proceeds |
        | Claude Code | a permitted fallback approval after every configured independent route was attempted and returned a typed failure | the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded |
        | OpenAI Codex | a permitted fallback approval after every configured independent route was attempted and returned a typed failure | the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded |
        | Cursor | a permitted fallback approval after every configured independent route was attempted and returned a typed failure | the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded |

    @surface.opencode
    Scenario Outline: OpenCode CLI and TUI gates enforce the real review result
      Given an OpenCode CLI or TUI planning phase has <review_state>
      When actual lifecycle dispatch through the installed profile-level plugins/safeword.js evaluates the phase transition with real configuration and collaborators, mocking only the reviewer process boundary
      Then <gate_result>

      Examples:
        | review_state | gate_result |
        | a pending review | the phase remains blocked |
        | a current approving receipt | the phase transition proceeds |
        | an approving receipt invalidated by a changed accepted scenario | the phase remains blocked with re-review named |
        | a permitted fallback approval after every configured independent route was attempted and returned a typed failure | the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded |

    @surface.claude-code-cloud @surface.cursor-cloud-agents
    Scenario Outline: Cloud phase gates enforce the real review result
      Given a planning phase on <cloud_host> has <review_state>
      When <cloud_entry> evaluates the phase transition with real configuration and collaborators, mocking only the remote reviewer process boundary
      Then <gate_result>

      Examples:
        | cloud_host | cloud_entry | review_state | gate_result |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM | a pending review | the phase remains blocked |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM | a current approving receipt | the phase transition proceeds |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM | an approving receipt invalidated by a changed accepted scenario | the phase remains blocked with re-review named |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM | a permitted fallback approval after every configured independent route was attempted and returned a typed failure | the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner | a pending review | the phase remains blocked |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner | a current approving receipt | the phase transition proceeds |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner | an approving receipt invalidated by a changed accepted scenario | the phase remains blocked with re-review named |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner | a permitted fallback approval after every configured independent route was attempted and returned a typed failure | the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded |

  @plan-implementability.TBU4.5F5ZZA.R7
  Rule: plan-implementability.TBU4.5F5ZZA.R7 — Research and review context remain untrusted evidence

    Scenario Outline: Retrieved instructions cannot change accepted scope
      Given a retrieved source contains instructions to change the accepted scope and relevant evidentiary claims
      When it is used during <consumption_point>
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
      Given a retrieved source requests private unpublished context and also exposes public evidence
      When structural quarantine exposes its public evidence during <consumption_point> while mocking only the retrieval process boundary
      Then the public evidence is retrieved while no private context is sent for retrieval or publication

      Examples:
        | consumption_point |
        | planning |
        | plan review |

    Scenario Outline: Reusable evidence records license and security limits
      Given a retrieved source has license identifier Apache-2.0 and security limit "do not execute retrieved code"
      When it is used during <consumption_point>
      Then <recorded_limits>

      Examples:
        | consumption_point | recorded_limits |
        | planning | Apache-2.0 and "do not execute retrieved code" appear in the plan evidence record before reuse |
        | plan review | Apache-2.0 and "do not execute retrieved code" appear in the review evidence record before reuse |

    Scenario Outline: Evidence records do not invent absent limits
      Given a retrieved source states no license or security limit
      When it is used during <consumption_point>
      Then no license or security limit is fabricated in the <evidence_record>

      Examples:
        | consumption_point | evidence_record |
        | planning | plan evidence record |
        | plan review | review evidence record |

  @plan-implementability.TBU4.5F5ZZA.R8
  Rule: plan-implementability.TBU4.5F5ZZA.R8 — Ungated surfaces receive advisory guidance only

    @surface.safeword-cli @surface.openai-codex
    Scenario: Generated Codex Cloud instructions cannot claim a gated approval
      Given repository instructions are generated for use by local Codex and may be read by Codex Cloud
      When the generated guidance describes the two planning phases
      Then it labels Codex Cloud execution advisory, claims neither review nor approval there, and directs authoritative planning to a supported gated surface

    @surface.opencode
    Scenario: OpenCode Desktop guidance cannot claim a gated approval
      Given the OpenCode profile plugin is read from Desktop where native lifecycle hooks are unavailable
      When its generated guidance describes the two planning phases
      Then it labels Desktop execution advisory, claims neither review nor approval there, and directs authoritative planning to OpenCode CLI or TUI

  @plan-implementability.TBU4.5F5ZZA.R9
  Rule: plan-implementability.TBU4.5F5ZZA.R9 — Review invalidation follows dependency direction

    Scenario Outline: A changed artifact invalidates exactly its dependent reviews
      Given both plans have current review receipts
      When <changed_input> changes
      Then <invalidated_reviews>

      Examples:
        | changed_input | invalidated_reviews |
        | accepted behavior | both plan reviews are invalidated |
        | accepted scope | both plan reviews are invalidated |
        | the accepted Implementation Plan | both plan reviews are invalidated |
        | only the Execution Plan | only the Execution Plan review is invalidated |
