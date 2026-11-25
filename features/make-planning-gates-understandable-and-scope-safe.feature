Feature: Make planning gates understandable and scope-safe
  Planning stops and waits tell a person what happened and how to continue
  without requiring them to read code or understand Safeword internals.

  @plan-implementability.NTB1.K3EBHB.R7
  Rule: plan-implementability.NTB1.K3EBHB.R7 — Every planning block gives one plain recovery action

    Scenario Outline: A planning block leads with a usable recovery
      Given planning cannot continue because <condition>
      When Safeword presents the stop
      Then the primary message names <plain_problem>, explains why safe progress stopped, and gives <one_action> as the single resume action

      Examples:
        | condition | plain_problem | one_action |
        | the canonical contract is missing | the planning rules are missing | run Safeword's installed-file reconciliation command |
        | the reviewed plan bytes no longer match | the plan changed after review | review the changed plan again |
        | required project context is unreadable | the project guidance could not be read | repair the named guidance file and retry |

    Scenario: Technical identifiers remain available without replacing the explanation
      Given a contract mismatch has a digest and review identifier useful to a Technical Builder
      When Safeword presents the stop
      Then the message leads with the plain problem and resume action and exposes the digest and review identifier afterward in a separately labeled technical-details section

  @plan-implementability.NTB1.K3EBHB.R8
  Rule: plan-implementability.NTB1.K3EBHB.R8 — Stale review messages name the meaningful change and affected plan

    Scenario Outline: Review invalidation explains exactly what must be reviewed again
      Given current plan reviews become stale because <meaningful_change>
      When Safeword presents the invalidation
      Then the message names <plain_change> as the reason, identifies <affected_review>, and tells the user to <recovery>

      Examples:
        | meaningful_change | plain_change | affected_review | recovery |
        | accepted product behavior changed | the agreed behavior changed | the Implementation Plan and Execution Plan reviews | revise the approach for the changed behavior and review it again |
        | the accepted implementation approach changed with human design approval enabled | the agreed approach changed | both plan reviews and human design approval | review the revised approach again |
        | only execution ordering changed | the order of the work changed | only the Execution Plan review | review the revised Execution Plan |
        | the canonical Implementation Planning contract changed with human design approval enabled | the rules for reviewing the approach changed | both plan reviews and human design approval | review the approach using the updated planning rules |

  @plan-implementability.NTB1.K3EBHB.R9
  Rule: plan-implementability.NTB1.K3EBHB.R9 — Promotion messages preserve evidence and name the resume phase

    Scenario Outline: Small work promotion names the decision to make in plain language
      Given task work holds a completed investigation and an unresolved <new_decision>
      When Safeword promotes the work
      Then the message preserves the completed investigation, leads with <plain_next_work>, and names <resume_place> only as supporting detail

      Examples:
        | new_decision | plain_next_work | resume_place |
        | a new user-visible behavior choice | decide what the user should experience | behavior definition |
        | a shared authorization approach | choose how shared authorization should work | Implementation Planning |
        | a changed required proof boundary | decide what must be exercised to prove the feature | Implementation Planning |

    Scenario Outline: Promotion preserves useful work already completed
      Given task work holds <preserved_progress> before a behavior-changing decision requires promotion
      When Safeword promotes the work
      Then the promotion message records <preserved_progress> as preserved rather than discarded or claimed as current proof of the new decision

      Examples:
        | preserved_progress |
        | a meaningful failing test |
        | reusable passing proof |

  @plan-implementability.NTB1.K3EBHB.R10
  Rule: plan-implementability.NTB1.K3EBHB.R10 — Non-technical walkthroughs prove block, invalidation, fallback, promotion, pending human design-approval, and pending user-owned scope or dispute recovery messages at real boundaries

    @manual @surface.safeword-cli
    Scenario Outline: A Non-Technical Builder can recover from every new stop or wait
      Given the Safeword CLI planning transition presents <message_category>
      When a Non-Technical Builder follows only the primary message
      Then exactly one imperative next action names the artifact or actor involved and tells them to <recovery> without a digest, review identifier, or phase name serving as the explanation
      And any pending decision is presented as unresolved

      Examples:
        | message_category | recovery |
        | a planning block | correct the named missing or invalid input |
        | a stale-review invalidation | review the named changed plan again |
        | a fallback review with reduced independence | inspect the honestly labeled fallback result |
        | a task promotion | decide the named behavior, approach, or proof sequence while preserving completed work |
        | pending human design approval | send the reviewed approach to the named approver |
        | pending user-owned scope decision | accept or decline the proposed scope change |
        | pending user-owned review dispute | provide the named user-owned disposition |

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Installed hosts render the same plain recovery outcome
      Given <planning_stop> is reached through <host_entry>
      When the installed Safeword workflow presents the stop
      Then the primary message <recovery_message>

      Examples:
        | host_entry | planning_stop | recovery_message |
        | Safeword CLI planning transition | pending human design approval | names the approver, the reviewed approach, and the action to request approval while keeping it pending |
        | Safeword CLI planning transition | a planning block due to a missing Execution Plan | says the execution steps are missing and tells the user to create and review the Execution Plan |
        | Claude Code lifecycle-hook dispatch | pending human design approval | names the approver, the reviewed approach, and the action to request approval while keeping it pending |
        | Claude Code lifecycle-hook dispatch | a planning block due to a missing Execution Plan | says the execution steps are missing and tells the user to create and review the Execution Plan |
        | Claude Code Cloud project hooks in a fresh VM | pending human design approval | names the approver, the reviewed approach, and the action to request approval while keeping it pending |
        | Claude Code Cloud project hooks in a fresh VM | a planning block due to a missing Execution Plan | says the execution steps are missing and tells the user to create and review the Execution Plan |
        | OpenAI Codex project workflow dispatch | pending human design approval | names the approver, the reviewed approach, and the action to request approval while keeping it pending |
        | OpenAI Codex project workflow dispatch | a planning block due to a missing Execution Plan | says the execution steps are missing and tells the user to create and review the Execution Plan |
        | Cursor project-hook dispatch | pending human design approval | names the approver, the reviewed approach, and the action to request approval while keeping it pending |
        | Cursor project-hook dispatch | a planning block due to a missing Execution Plan | says the execution steps are missing and tells the user to create and review the Execution Plan |
        | Cursor Cloud Agents project hooks in a fresh runner | pending human design approval | names the approver, the reviewed approach, and the action to request approval while keeping it pending |
        | Cursor Cloud Agents project hooks in a fresh runner | a planning block due to a missing Execution Plan | says the execution steps are missing and tells the user to create and review the Execution Plan |

    @surface.claude-code-cloud @surface.cursor-cloud-agents
    Scenario Outline: Cloud hosts render pending approval as a recorded handoff
      Given pending human design approval is reached through <cloud_host>
      When the installed Safeword workflow presents the wait
      Then reviewable output records the reviewed approach and pending approver, returns promptly, and asks the user to send that approach to the named approver as the single next action

      Examples:
        | cloud_host |
        | Claude Code Cloud project hooks in a fresh VM |
        | Cursor Cloud Agents project hooks in a fresh runner |

    @surface.safeword-cli
    Scenario: Reduced-independence fallback is labeled honestly at the installed boundary
      Given a different agent could not review and a named fallback reviewer approved
      When the Safeword CLI planning transition presents the result
      Then the message names the actual reviewer and reduced independence, never calls the result independent review, and gives inspection of the fallback result and its limits as the single next action

    @rejection
    Scenario Outline: Ambiguous recovery fails the walkthrough
      Given a planning message contains <bad_guidance>
      When the test checks the primary message for a stated problem and one action naming its artifact or actor
      Then the message fails because <failure>

      Examples:
        | bad_guidance | failure |
        | only a contract digest and internal phase name | the problem and next action are not understandable without Safeword internals |
        | two competing resume actions | the user cannot identify one concrete next action |
