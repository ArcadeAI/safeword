Feature: Record disputed plan findings without blocking unrelated work
  A disagreement has an honest disposition and a clear next action.

  @plan-implementability.TBU5.26FK42.R1
  Rule: plan-implementability.TBU5.26FK42.R1 — An originating reviewer cannot be the sole adjudicator of its disputed finding

    Scenario: A reviewer cannot unilaterally settle its own disputed finding
      Given a finding is disputed and its originating reviewer is identified
      When that reviewer alone attempts to settle the dispute
      Then no terminal adjudicated disposition is accepted

    Scenario: Missing reviewer provenance prevents adjudication
      Given a disputed finding has no bound originating reviewer identity
      When adjudication is requested
      Then it is refused with the missing reviewer identity named

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

    Scenario: A disputed blocking finding remains unapproved
      Given a reviewer raises a blocking correctness finding
      When the author records a disagreement citing the relevant plan text or requirement
      Then the finding remains unresolved and the plan is not approved

    Scenario: Unrelated work continues while a blocking finding is unresolved
      Given a blocking plan finding remains disputed and unapproved
      When the author continues work that does not depend on plan approval
      Then that unrelated work can proceed without resolving the finding

    Scenario Outline: Every change to accepted product scope belongs to the user
      Given accepted product scope is documented
      When <proposer> proposes <change> during <stage>
      Then the change requires a user decision before it changes accepted scope

      Examples:
        | proposer | change | stage |
        | the author | an addition | planning |
        | a reviewer | a removal | planning |
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
        | a semantic change | stale |
        | only normalized whitespace or comments | current |

  @plan-implementability.TBU5.26FK42.R3
  Rule: plan-implementability.TBU5.26FK42.R3 — A disputed optional classification cannot make unaccepted advice blocking

    Scenario: A disputed optional classification follows the existing nonblocking rule
      Given a suggestion outside accepted scope is disputed as optional strengthening
      When a fresh adjudicator applies the existing classification rule
      Then the suggestion remains nonblocking unless the user accepts it into scope

    @surface.safeword-cli @rejection
    Scenario: Accepted unfinished scope blocks the plan gate
      Given the user has accepted a strengthening suggestion into scope
      And the accepted work remains unfinished
      When the installed plan gate evaluates the plan
      Then advancement is refused with the outstanding work named

  @plan-implementability.TBU5.26FK42.R4
  Rule: plan-implementability.TBU5.26FK42.R4 — Headless work records pending decisions without inventing approval

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: A headless run returns promptly with a pending decision
      Given <host> cannot collect a user-owned scope decision in this run
      When the installed workflow reaches that decision
      Then the invocation exits promptly with approval unchanged and one action to resume

      Examples:
        | host |
        | Claude Code noninteractive dispatch |
        | Claude Code Cloud |
        | OpenAI Codex noninteractive dispatch |
        | OpenCode CLI or TUI noninteractive dispatch |
        | Cursor project-hook dispatch without an interactive user |
        | Cursor Cloud Agents |

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: A later session recovers the pending decision
      Given <host> returned with a pending user-owned scope decision
      When <later_context> requests the same finding
      Then it recovers the same pending decision with approval unchanged and one action to resume

      Examples:
        | host | later_context |
        | Claude Code noninteractive dispatch | a new local Claude Code session |
        | Claude Code Cloud | a new session after the original VM is reclaimed |
        | OpenAI Codex noninteractive dispatch | a new local OpenAI Codex session |
        | OpenCode CLI or TUI noninteractive dispatch | a new local OpenCode session |
        | Cursor project-hook dispatch without an interactive user | a new local Cursor session |
        | Cursor Cloud Agents | a new session after the original runner is reclaimed |

    @surface.claude-code
    Scenario: An available user resolves the pending choice
      Given the installed local workflow can collect a user-owned scope decision
      When the user records a disposition
      Then the disposition is recorded without leaving the finding pending

    Scenario: Unresolved correctness is not reported as approval
      Given a blocking correctness finding remains disputed
      When the workflow reports its current disposition
      Then the result states that the finding is unresolved and the plan remains unapproved

  @plan-implementability.TBU5.26FK42.R5
  Rule: plan-implementability.TBU5.26FK42.R5 — A fresh review follows material correction, not silent redispatch

    Scenario Outline: A review request distinguishes correction from retry
      Given a blocking finding is disputed and <review_basis>
      When the next review is requested
      Then <result>

      Examples:
        | review_basis | result |
        | the plan or review basis was materially corrected | a fresh review can evaluate the correction |
        | neither the plan nor review basis changed | unchanged redispatch is refused and the finding and owner are named |
