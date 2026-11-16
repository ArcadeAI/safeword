Feature: Record disputed plan findings without blocking unrelated work
  A disagreement has an honest disposition and a clear next action.

  @plan-implementability.TBU5.26FK42.R1
  Rule: plan-implementability.TBU5.26FK42.R1 — An originating reviewer cannot be the sole adjudicator of its disputed finding

    @surface.safeword-cli @rejection
    Scenario: A reviewer cannot unilaterally settle its own disputed finding
      Given a finding is disputed and its originating reviewer is identified
      When that reviewer alone attempts to settle the dispute through the installed workflow
      Then no terminal adjudicated disposition is accepted

    @surface.safeword-cli @rejection
    Scenario: Exhausted classification routes cannot reuse the originating reviewer
      Given optional classification is disputed and independent adjudicator routes are exhausted
      And the only remaining configured route is the originating reviewer
      When the installed workflow routes the classification
      Then it preserves a pending user decision with one scope-decision action instead of accepting sole adjudication by the originating reviewer

    Scenario: Missing reviewer provenance prevents adjudication
      Given a disputed finding has no bound originating reviewer identity
      When adjudication is requested
      Then it is refused with the missing reviewer identity named

    @surface.safeword-cli
    Scenario: A fresh adjudicator can settle optional classification
      Given a reviewer-raised optional classification is disputed and its origin is bound
      When a fresh independent adjudicator applies the accepted classification rule through the installed workflow
      Then its grounded classification is recorded

  @plan-implementability.TBU5.26FK42.R2
  Rule: plan-implementability.TBU5.26FK42.R2 — Disagreements have explicit effects on progress and user-owned scope

    @surface.safeword-cli
    Scenario: Nonblocking advice can be disputed without stopping progress
      Given a plan has nonblocking advice outside its accepted scope
      When the author records a disagreement citing the relevant plan text or requirement
      Then the disagreement is recorded and the otherwise acceptable plan may advance

    @surface.safeword-cli @rejection
    Scenario: An unsupported dispute class is refused
      Given a contested finding does not match a supported dispute class
      When the installed workflow routes the disagreement
      Then it refuses the class and names it

    Scenario Outline: A disputed blocking finding remains unapproved
      Given a reviewer raises a blocking <finding_class> finding
      When the author records a disagreement citing the relevant plan text or requirement
      Then the finding remains unresolved and the plan is not approved

      Examples:
        | finding_class |
        | correctness |
        | relevance |

    @rejection
    Scenario: A disagreement without supporting evidence is refused
      Given a reviewer has raised a finding
      When the author records a disagreement without an accepted requirement or plan text
      Then the disagreement is refused with the missing evidence named

    Scenario: Unrelated work continues while a blocking finding is unresolved
      Given a blocking plan finding remains disputed and unapproved
      When the author reads project context or works on a separate ticket
      Then that independent work can proceed while execution planning and implementation for the disputed plan remain gated

    Scenario Outline: Every change to accepted product scope belongs to the user
      Given accepted product scope is documented
      When <proposer> proposes <change> during <stage>
      Then the change requires a user decision before it changes accepted scope

      Examples:
        | proposer | change | stage |
        | the author | an addition | planning |
        | a reviewer | a removal | planning |
        | an adjudicator | an addition | planning |
        | a fallback reviewer | an addition | planning |
        | the implementing agent | a narrowing | implementation |

    Scenario: Correcting an in-scope omission does not change scope
      Given an accepted requirement is missing from the plan
      When the author adds the missing requirement without changing its boundary
      Then the correction does not require a new scope decision

    Scenario Outline: Provenance determines review currency
      Given a review has <change> in its bound context
      When its current provenance is compared
      Then the review is <result>

      Examples:
        | change | result |
        | a semantic change to bound context | stale |
        | only whitespace or comments in a normalized context slice | current |
        | any byte change to the reviewed plan | stale |
        | any byte change to the canonical contract | stale |

    @surface.safeword-cli @rejection
    Scenario Outline: A currency dispute is settled by provenance rather than either party
      Given <context_change> and a party claims the review is <claimed_currency>
      When the installed workflow resolves the disputed currency
      Then it reports the review <actual_currency> from bound provenance rather than accepting the party's claim

      Examples:
        | context_change | claimed_currency | actual_currency |
        | bound semantic review context has changed | current | stale |
        | only whitespace changed in a normalized context slice | stale | current |

  @plan-implementability.TBU5.26FK42.R3
  Rule: plan-implementability.TBU5.26FK42.R3 — A disputed optional classification cannot make unaccepted advice blocking

    @surface.safeword-cli @rejection
    Scenario Outline: A disputed optional classification follows the existing nonblocking rule
      Given a reviewer raised a nonblocking suggestion outside accepted scope which has not been accepted
      And the optional classification is <classification_state>
      When the installed plan gate evaluates the otherwise acceptable plan
      Then the plan can advance without treating the disputed suggestion as required work

      Examples:
        | classification_state |
        | awaiting a fresh adjudicator |
        | confirmed nonblocking by a fresh adjudicator |
        | pending a user scope decision after independent adjudicator routes are exhausted |

    @surface.safeword-cli @rejection
    Scenario: A blocking label no longer blocks after independent optional classification
      Given a reviewer raised an unaccepted suggestion as blocking
      And a fresh adjudicator classified it as optional strengthening outside accepted scope
      When the installed plan gate evaluates the otherwise acceptable plan
      Then the plan can advance without treating the suggestion as required work

    @surface.safeword-cli @rejection
    Scenario Outline: An adjudicator cannot make unaccepted scope required
      Given an otherwise acceptable plan excludes a proposed strengthening suggestion
      And <resolver> labels the unaccepted suggestion as required work
      When the installed plan gate evaluates the plan
      Then accepted scope remains unchanged and the plan can advance without that suggestion

      Examples:
        | resolver |
        | a fresh adjudicator |
        | a fallback reviewer |

    @rejection
    Scenario: A genuine in-scope defect cannot be dismissed as optional advice
      Given a disputed finding protects an accepted in-scope requirement
      When a fresh adjudicator applies the existing classification rule
      Then the defect is classified as blocking and the plan gate refuses advancement

    @surface.safeword-cli @rejection
    Scenario: Calling a blocking in-scope finding optional does not approve the plan
      Given a reviewer raises a blocking finding tied to an accepted in-scope requirement
      And the author disputes it as optional while classification remains unresolved
      When the installed plan gate evaluates the plan
      Then the plan remains unapproved and the unresolved finding is named

    @surface.safeword-cli @rejection
    Scenario: Accepted unfinished scope blocks the plan gate
      Given the user has accepted a strengthening suggestion into scope
      And the accepted work remains unfinished
      When the installed plan gate evaluates the plan
      Then advancement is refused with the outstanding work named

  @plan-implementability.TBU5.26FK42.R4
  Rule: plan-implementability.TBU5.26FK42.R4 — Headless work records pending decisions without inventing approval

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: A headless run returns promptly with a pending decision
      Given <host> cannot collect a user-owned scope decision in this run
      When the installed workflow reaches that decision
      Then it returns without requesting or waiting for interactive input, with approval unchanged and a durably recorded pending decision identifying the finding and one action to resume

      Examples:
        | host |
        | Claude Code noninteractive dispatch |
        | Claude Code Cloud |
        | OpenAI Codex noninteractive dispatch |
        | Cursor project-hook dispatch without an interactive user |
        | Cursor Cloud Agents |

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: A later session recovers the pending decision
      Given a real headless run through the installed workflow on <host> produced the durable pending user-owned scope decision, without a preseeded pending record
      When <later_context> requests the same finding
      Then it recovers the same pending decision with approval unchanged and one action to resume

      Examples:
        | host | later_context |
        | Claude Code noninteractive dispatch | a new local Claude Code session |
        | Claude Code Cloud | a new session after the original VM is reclaimed |
        | OpenAI Codex noninteractive dispatch | a new local OpenAI Codex session |
        | Cursor project-hook dispatch without an interactive user | a new local Cursor session |
        | Cursor Cloud Agents | a new session after the original runner is reclaimed |

    @surface.claude-code
    Scenario: An available user resolves the pending choice
      Given the installed local workflow can collect a user-owned scope decision
      When the user records a disposition
      Then the disposition is recorded without leaving the finding pending

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.cursor @surface.cursor-cloud-agents @rejection
    Scenario Outline: Headless unresolved correctness is not reported as approval
      Given <host> has a disputed blocking correctness finding
      When the installed workflow reports its current disposition without user input
      Then it returns without requesting or waiting for interactive input, with a durable unresolved disposition identifying the finding, the unapproved plan and one action to resume

      Examples:
        | host |
        | Claude Code noninteractive dispatch |
        | Claude Code Cloud |
        | OpenAI Codex noninteractive dispatch |
        | Cursor project-hook dispatch without an interactive user |
        | Cursor Cloud Agents |

  @plan-implementability.TBU5.26FK42.R5
  Rule: plan-implementability.TBU5.26FK42.R5 — A fresh review follows material correction, not silent redispatch

    @surface.safeword-cli
    Scenario Outline: Every supported disagreement records a disposition and recovery action
      Given the installed workflow receives <dispute>
      When it records the disagreement
      Then it records <disposition> and names <recovery_action>

      Examples:
        | dispute | disposition | recovery_action |
        | nonblocking advice | nonblocking disagreement | continue the otherwise eligible review |
        | a user-owned scope choice when the user is unavailable | pending user decision | ask the user to decide the proposed scope change |
        | disputed optional classification | pending classification | obtain a fresh eligible classification |
        | blocking correctness | unresolved blocking finding | correct the plan or review basis before fresh review |
        | blocking relevance | unresolved blocking finding | correct the plan or review basis before fresh review |

    # lower-level proof: enumerate every supported dispute class and its typed
    # disposition and recovery action, including unsupported-class refusal.

    @surface.safeword-cli @rejection
    Scenario Outline: A correction requires a fresh passing verdict before approval
      Given a disputed blocking finding and a materially corrected plan
      And <review_state> for the exact corrected plan bytes
      When the installed plan gate evaluates the plan
      Then <gate_result>

      Examples:
        | review_state | gate_result |
        | no fresh verdict exists | the finding remains unresolved and the plan remains unapproved |
        | a fresh review passes with no other blockers | the plan gate permits advancement |

    @surface.safeword-cli @rejection
    Scenario Outline: A review request distinguishes correction from retry
      Given a blocking finding is disputed and <review_basis>
      When the next review is requested through the installed workflow
      Then <result>

      Examples:
        | review_basis | result |
        | the plan or review basis was materially corrected | a fresh review can evaluate the correction |
        | the user declined an expansion and that disposition changed the review basis | a fresh review can evaluate the unchanged plan against the recorded decision |
        | an adjudicated optional classification materially changed the review basis | a fresh review can evaluate the recorded classification |
        | neither the plan nor review basis changed | unchanged redispatch is refused and the finding and owner are named |
        | only the disagreement was logged | unchanged redispatch is refused and the finding and owner are named |

    # lower-level proof: vary the number of prior materially corrected passes,
    # including large values, and verify no pass-count cap prevents fresh review.
    Scenario: Later material corrections remain eligible for review
      Given three prior materially corrected plan reviews found blocking defects
      When the author materially corrects the plan or review basis again
      Then a fresh review can evaluate the correction without a fixed pass cap
