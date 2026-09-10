Feature: Resolve disputed plan findings without review loops
  A contested plan finding reaches the authority that owns the disagreement
  and ends with an honest disposition.
  # skip: Advisory-only hosts cannot enforce dispute gates; advisory labeling is owned by plan-implementability.TBU4.R13.

  @plan-implementability.TBU5.26FK42.R1
  Rule: plan-implementability.TBU5.26FK42.R1 — The originating reviewer cannot be the sole adjudicator of its disputed finding

    @rejection
    Scenario Outline: A disputed finding requires a resolver other than its originating reviewer alone
      Given a reviewer-raised finding is disputed by the author and its originating reviewer identity is bound in the finding provenance
      When <resolver> attempts to adjudicate the finding
      Then <result>

      Examples:
        | resolver | result |
        | the originating reviewer alone | no terminal correctness disposition is accepted |
        | the user for a scope decision | the user's scope disposition is accepted |
        | a fresh adjudicator for correctness | the adjudicator's contract-grounded disposition is accepted |

  @plan-implementability.TBU5.26FK42.R2
  Rule: plan-implementability.TBU5.26FK42.R2 — Scope and optional-strengthening disputes route to the user, currency disputes resolve from bound provenance, and correctness or relevance disputes route to a fresh adjudicator applying the accepted contract and scope

    @surface.safeword-cli
    Scenario Outline: Dispute classification selects one explicit resolver
      Given a contested finding concerns <dispute_class>
      When Safeword routes the dispute
      Then <routing_result>

      Examples:
        | dispute_class | routing_result |
        | whether work belongs in accepted scope | the user receives an accept-or-decline scope choice |
        | whether advice is optional strengthening | the user owns scope while a fresh adjudicator applies the baseline classification |
        | whether a review is stale | bound provenance determines currency without a preference vote |
        | whether an in-scope contract is correct | a fresh adjudicator applies the accepted contract and scope |
        | whether a finding is relevant to an accepted Rule | a fresh adjudicator applies that Rule and the accepted boundary |

    Scenario Outline: Provenance resolves review currency without a preference vote
      Given a disputed currency finding has <bound_change>
      When Safeword compares its bound review provenance
      Then <currency_result>

      Examples:
        | bound_change | currency_result |
        | a semantic change to bound review context | the affected review is stale and must be performed again |
        | only whitespace or comments changed in normalized context | the affected review remains current |

  @plan-implementability.TBU5.26FK42.R3
  Rule: plan-implementability.TBU5.26FK42.R3 — When a reviewer disputes whether a finding is optional strengthening, the fresh adjudicator applies the nonblocking classification owned by 5F5ZZA; the dispute itself cannot make the finding blocking, and only user acceptance can change the accepted scope

    @rejection
    Scenario Outline: Optional advice changes state only through user scope authority
      Given a reviewer-authored strengthening suggestion outside the accepted boundary is recorded
      When <decision_state>
      Then <result>

      Examples:
        | decision_state | result |
        | the author disputes whether it is optional | the suggestion remains nonblocking while a fresh adjudicator applies the baseline classification |
        | the user declines it | the decline is recorded and the unchanged plan remains reviewable against accepted scope |
        | the user accepts it | the acceptance is recorded before the suggestion can be treated as required work |

    @rejection
    Scenario: An adjudicator cannot turn scope expansion into required work
      Given a fresh adjudicator proposes a blocking finding that would expand the accepted boundary
      When dispute handling classifies the finding against accepted scope
      Then the proposal is recorded as a pending user-owned scope decision rather than required work

  @plan-implementability.TBU5.26FK42.R4
  Rule: plan-implementability.TBU5.26FK42.R4 — Headless and cloud work preserves current nonblocking human-approval behavior, records unresolved dispositions for later review, and never turns an unresolved correctness dispute into approval

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Unavailable human authority produces a durable pending result
      Given <host_entry> cannot collect the user-owned decision during the current run
      When actual installed dispute resolution reaches that authority boundary with real configuration and collaborators, mocking only the unavailable human response
      Then the run exits cleanly with the finding pending, the current plan approval unchanged, and one action for resuming with the user

      Examples:
        | host_entry |
        | Claude Code noninteractive dispatch |
        | Claude Code Cloud project hooks in a fresh VM |
        | OpenAI Codex noninteractive workflow dispatch |
        | OpenCode CLI/TUI noninteractive dispatch |
        | Cursor project-hook dispatch without an interactive user |
        | Cursor Cloud Agents project hooks in a fresh runner |

    @surface.claude-code
    Scenario: Available interactive authority resolves instead of remaining pending
      Given local Claude Code can collect the user-owned decision during the current run
      When actual installed dispute resolution reaches that authority boundary and the user records a disposition
      Then the run records that disposition and does not exit with the finding pending

    @rejection
    Scenario: An unresolved correctness dispute cannot become approval
      Given every available independent adjudication route is exhausted while a correctness finding remains disputed
      When the resolution result is recorded
      Then it reports unresolved after available routes and does not approve the plan

  @plan-implementability.TBU5.26FK42.R5
  Rule: plan-implementability.TBU5.26FK42.R5 — Every dispute reaches an honest typed result without a fixed correctness-pass cap, reviewer-owned scope, or silent retry loop

    Scenario Outline: Supported dispute outcomes terminate explicitly
      Given a contested finding has <adjudicated_state>
      When dispute handling completes
      Then the result is recorded as <terminal_result> without silent redispatch

      Examples:
        | adjudicated_state | terminal_result |
        | confirmed against the accepted contract | upheld |
        | valid but nonblocking advice | reclassified |
        | unsupported by the accepted contract or scope | rejected |
        | awaiting the user's scope choice | pending user-owned scope decision |
        | still contested after every available independent route | unresolved after available routes |

    Scenario Outline: Closed disputes distinguish later corrections from silent retries
      Given a finding has a terminal upheld result and <later_event>
      When dispute handling evaluates the next review request
      Then <cycle_result>

      Examples:
        | later_event | cycle_result |
        | the author changes the exact plan bytes to correct it | the request enters a normal fresh author-correct-re-review cycle |
        | the same closed finding is redispatched without an author correction | redispatch is refused with the closed disposition named |

    Scenario: Correctness adjudication follows available routes rather than a fixed pass count
      Given one independent adjudication route returned a typed failure while another capable independent route remains available
      When dispute recovery continues
      Then the later route is attempted and its contract-grounded terminal correctness result is recorded instead of unresolved after an arbitrary pass count
