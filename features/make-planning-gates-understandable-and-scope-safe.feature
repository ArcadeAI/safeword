Feature: Make planning gates understandable and scope-safe
  Safeword keeps review inside accepted scope and gives builders one plain recovery action.
  Untagged scope-review scenarios are surface-agnostic contract checks; tagged scenarios prove installed entry points.

  @plan-implementability.NTB1.K3EBHB.R1
  Rule: plan-implementability.NTB1.K3EBHB.R1 — Accepted scope combines ticket, project, milestone, and inherited boundaries

    @rejection
    Scenario Outline: A plan cannot ignore any binding scope source
      Given a plan conflicts with <scope_source>
      When the accepted boundary is resolved
      Then the rejection cites <scope_source> and the conflicting work cannot enter the plan

      Examples:
        | scope_source |
        | the ticket's declared scope |
        | a recorded out-of-scope decision |
        | a project non-goal |
        | a milestone non-goal |
        | an inherited parent boundary |

    Scenario: Work consistent with every binding source enters the accepted boundary
      Given a plan conflicts with no ticket scope, recorded non-goal, milestone non-goal, or inherited parent boundary
      When the accepted boundary is resolved
      Then the work is admitted by the resolved accepted boundary

    @rejection
    Scenario: An unreadable binding scope source fails closed
      Given one binding scope source is absent or unreadable when the accepted boundary is resolved
      When scope completeness is reviewed
      Then approval is blocked and the unresolvable source is named as the one recovery action

    @surface.safeword-cli
    Scenario Outline: Installed review dispatch enforces the resolved boundary
      Given an Implementation Plan <boundary_state>
      When actual installed CLI review dispatch runs with real configuration and collaborators
      Then <review_result>

      Examples:
        | boundary_state | review_result |
        | conflicts with an inherited parent boundary | review rejects the conflict and cites the inherited boundary |
        | is consistent with every binding boundary | boundary resolution admits the plan to completeness review |

  @plan-implementability.NTB1.K3EBHB.R2
  Rule: plan-implementability.NTB1.K3EBHB.R2 — Completeness checks both omissions and overreach

    @rejection
    Scenario Outline: Missing and extra work both fail completeness
      Given a plan <scope_defect>
      When scope completeness is reviewed
      Then approval is blocked with that mismatch named against the accepted boundary

      Examples:
        | scope_defect |
        | omits an accepted obligation |
        | adds an unapproved capability |
        | contradicts the accepted boundary |

    Scenario: A complete in-scope plan passes completeness
      Given a plan covers every accepted obligation, contains no contradiction, and proposes no unapproved capability
      When scope completeness is reviewed
      Then completeness raises no blocking mismatch

    @surface.safeword-cli
    Scenario Outline: Installed review dispatch enforces scope completeness
      Given an Implementation Plan <completeness_state>
      When actual installed CLI review dispatch runs with real configuration and collaborators
      Then <review_result>

      Examples:
        | completeness_state | review_result |
        | adds an unapproved capability | approval is blocked with that capability named against the accepted boundary |
        | covers every accepted obligation without contradiction or overreach | completeness raises no blocking mismatch |

  @plan-implementability.NTB1.K3EBHB.R3
  Rule: plan-implementability.NTB1.K3EBHB.R3 — Reviewer corrections cannot silently expand scope

    @rejection
    Scenario: An in-scope false clearance blocks approval
      Given a review verdict records an in-scope false clearance
      When the verdict is produced
      Then correction is required before approval

    Scenario: An out-of-scope improvement remains optional
      Given a review verdict records an out-of-scope resilience improvement
      When the verdict is produced
      Then the improvement is nonblocking and the capability stays outside the accepted boundary and plan until the user expands it

  @plan-implementability.NTB1.K3EBHB.R4
  Rule: plan-implementability.NTB1.K3EBHB.R4 — Declined strengthening remains declined and reviewable

    @rejection
    Scenario: Declining optional scope does not waive review of the accepted boundary
      Given a nonblocking strengthening proposal stands declined by the user
      When the unchanged plan is resubmitted
      Then the decline is recorded and the plan is reviewed again only against the resolved accepted boundary

    Scenario: Accepting optional scope records the authority that expanded it
      Given a nonblocking strengthening stands proposed outside the accepted boundary
      When the user explicitly accepts it through the host's human channel
      Then the accepted boundary expands with that user authority recorded and the revised plan is reviewed against it

    @surface.safeword-cli @surface.claude-code
    Scenario Outline: Installed entry points honor human scope acceptance
      Given a nonblocking strengthening outside the accepted boundary and an explicit acceptance recorded through <host>'s human channel
      When <installed_entry> runs with real configuration and collaborators
      Then the accepted boundary expands with that user authority recorded and the revised plan is reviewed against it

      Examples:
        | host | installed_entry |
        | Safeword CLI | actual installed CLI dispatch |
        | Claude Code | actual lifecycle dispatch from installed project hooks |

    @rejection @surface.safeword-cli @surface.claude-code
    Scenario Outline: Installed entry points reject agent-authored scope acceptance
      Given a nonblocking strengthening outside the accepted boundary and no response recorded through <host>'s human channel
      When an acceptance claim written through the agent-writable path is presented with the revised plan through <installed_entry>
      Then the accepted boundary does not expand and the capability stays outside the plan

      Examples:
        | host | installed_entry |
        | Safeword CLI | actual installed CLI dispatch |
        | Claude Code | actual lifecycle dispatch from installed project hooks |

  @plan-implementability.NTB1.K3EBHB.R5
  Rule: plan-implementability.NTB1.K3EBHB.R5 — Guides and research cannot expand accepted scope

    @rejection
    Scenario Outline: An externally suggested capability remains outside the plan
      Given <source> suggests a capability outside the accepted boundary and the user has not expanded that boundary
      When the Implementation Plan is authored
      Then the capability remains outside the plan

      Examples:
        | source |
        | applicable project guidance |
        | current external research |

    Scenario: Accepted guidance can inform the plan after scope expands
      Given project guidance suggests a capability and the user explicitly expanded the accepted boundary to include it
      When the Implementation Plan is authored
      Then the capability enters the plan with the user's scope authority recorded

  @plan-implementability.NTB1.K3EBHB.R6
  Rule: plan-implementability.NTB1.K3EBHB.R6 — Human design approval occurs once on the approach

    @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    # Proof note: enabled rows wait for the surfaced approach prompt before asserting that Execution Planning has not begun.
    Scenario Outline: Interactive approval behavior follows the gate setting
      Given the human design-approval gate is <setting> in an interactive <host> session
      When <installed_entry> reaches the reviewed Implementation Plan's phase transition with real configuration and collaborators
      Then <outcome>

      Examples:
        | host | installed_entry | setting | outcome |
        | Safeword CLI | actual installed CLI dispatch | disabled | Execution Planning begins without a prompt |
        | Safeword CLI | actual installed CLI dispatch | enabled | the approach is surfaced for approval and Execution Planning has not begun |
        | Claude Code | actual lifecycle dispatch from installed project hooks | enabled | the approach is surfaced for approval and Execution Planning has not begun |
        | OpenAI Codex | actual lifecycle dispatch from installed project hooks | enabled | the approach is surfaced for approval and Execution Planning has not begun |
        | OpenCode CLI | actual lifecycle dispatch from the installed profile plugin | enabled | the approach is surfaced for approval and Execution Planning has not begun |
        | Cursor | actual lifecycle dispatch from installed project hooks | enabled | the approach is surfaced for approval and Execution Planning has not begun |

    Scenario: Approach approval is not requested twice when the approach is unchanged
      Given the approach was approved once and the Implementation Plan was revised without changing any behavior-shaping choice, tradeoff, or system boundary
      When the plan re-enters the human design-approval gate
      Then no second approach approval is requested and the prior approval remains linked

    Scenario: A changed approach requires new approval
      Given the approach was approved once and the Implementation Plan was revised by changing a behavior-shaping choice, tradeoff, or system boundary
      When the plan re-enters the human design-approval gate
      Then a new approach approval is requested and the prior approval no longer clears the gate

    @rejection @surface.claude-code
    Scenario: An agent cannot preserve approval by declaring a changed approach unchanged
      Given the approach was approved once, the Implementation Plan changed a behavior-shaping choice, tradeoff, or system boundary, and an "approach unchanged" claim was written through the agent-writable path
      When actual lifecycle dispatch from installed Claude Code project hooks reaches the human design-approval gate with real configuration and collaborators
      Then a new approach approval is requested and the prior approval no longer clears the gate

    @surface.claude-code
    Scenario Outline: Installed re-entry honors approval only while the approach is unchanged
      Given the gate is enabled, the approach was approved through Claude Code's human channel, and the Implementation Plan was revised <revision_kind>
      When actual lifecycle dispatch from installed project hooks reaches the phase transition with real configuration and collaborators
      Then <reentry_result>

      Examples:
        | revision_kind | reentry_result |
        | without changing any behavior-shaping choice, tradeoff, or system boundary | Execution Planning begins with no second approval requested and the prior approval still linked |
        | by changing a behavior-shaping choice, tradeoff, or system boundary | a new approval is requested and the prior approval no longer clears the gate |

    @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario Outline: Granted human approval clears the installed approach gate
      Given the human design-approval gate is enabled and <installed_entry> surfaced the approach for a response through <host>'s human channel with real configuration and collaborators
      When the user approves the approach through that host channel
      Then Execution Planning begins with that approval recorded against the approach

      Examples:
        | host | installed_entry |
        | Safeword CLI | actual installed CLI dispatch |
        | Claude Code | actual lifecycle dispatch from installed project hooks |
        | OpenAI Codex | actual lifecycle dispatch from installed project hooks |
        | OpenCode CLI | actual lifecycle dispatch from the installed profile plugin |
        | Cursor | actual lifecycle dispatch from installed project hooks |

    @rejection
    Scenario: Refusing an approach keeps the same approach blocked
      Given the human design-approval gate is enabled and the user refused the presented approach
      When the unchanged approach is resubmitted
      Then Execution Planning remains blocked and the refusal remains linked to that approach

    Scenario: Revising a refused approach permits a new decision
      Given the user refused the presented approach
      When a revised approach changing a behavior-shaping choice, tradeoff, or system boundary is submitted
      Then a new approach approval is requested for the revised approach

    @rejection
    Scenario: Only human authority can clear a pending approach approval
      Given a headless session recorded a pending approach approval and no response through the host's human channel
      When an approval claim written through the agent-writable path is presented without a matching host-channel response
      Then Execution Planning remains blocked with human approval named as the next action

    @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario Outline: Installed local entry points reject agent-written approval claims
      Given <installed_entry> surfaced a pending approach with real configuration and no response exists in <host>'s human channel
      When an approval claim written through the agent-writable path is presented through that installed entry point
      Then Execution Planning remains blocked with human approval named as the next action

      Examples:
        | host | installed_entry |
        | Safeword CLI | actual installed CLI dispatch |
        | Claude Code | actual lifecycle dispatch from installed project hooks |
        | OpenAI Codex | actual lifecycle dispatch from installed project hooks |
        | OpenCode CLI | actual lifecycle dispatch from the installed profile plugin |
        | Cursor | actual lifecycle dispatch from installed project hooks |

    @surface.claude-code-cloud @surface.cursor-cloud-agents
    Scenario Outline: Cloud hosts reject agent-written approval claims
      Given <installed_entry> surfaced a pending approach with real configuration and no response exists in <host>'s human channel
      When an approval claim written through the agent-writable path is presented through that installed entry point
      Then Execution Planning remains blocked with human approval named as the next action

      Examples:
        | host | installed_entry |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner |

    @surface.claude-code-cloud @surface.cursor-cloud-agents
    Scenario Outline: Pending cloud approval survives runner reclamation
      Given <cloud_host> exited with an approach awaiting approval and its ephemeral runner was reclaimed
      When the user approves the approach through the host's human channel in a new session
      Then the same pending approach resolves and Execution Planning begins with that approval recorded against the approach

      Examples:
        | cloud_host |
        | Claude Code Cloud |
        | Cursor Cloud Agents |

    @rejection @surface.claude-code-cloud @surface.cursor-cloud-agents
    Scenario Outline: A lost cloud approval record cannot silently clear the gate
      Given <cloud_host> exited with an approach awaiting approval and the pending approval record is unreadable in a new session
      When the user responds through the host's human channel
      Then Execution Planning remains blocked and the message names re-surfacing the approach as the one next action

      Examples:
        | cloud_host |
        | Claude Code Cloud |
        | Cursor Cloud Agents |

    @surface.claude-code-cloud @surface.cursor-cloud-agents @surface.openai-codex
    # Proof note: step definitions wait on the pending-approval artifact and process exit status, never on a fixed delay.
    Scenario Outline: Headless approval exits cleanly through the real host lifecycle
      Given the human design-approval gate is <setting> in <headless_host>
      When <host_entry> reaches the reviewed Implementation Plan's phase transition with real configuration and collaborators
      Then <headless_outcome>

      Examples:
        | headless_host | host_entry | setting | headless_outcome |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM | enabled | the host session exits successfully with the approach surfaced, approval pending, and Execution Planning not begun |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner | enabled | the host session exits successfully with the approach surfaced, approval pending, and Execution Planning not begun |
        | OpenAI Codex headless | actual installed local lifecycle dispatch in headless mode | enabled | the host session exits successfully with the approach surfaced, approval pending, and Execution Planning not begun |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM | disabled | the host session exits successfully after completing the phase transition without recording pending approval |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner | disabled | the host session exits successfully after completing the phase transition without recording pending approval |
        | OpenAI Codex headless | actual installed local lifecycle dispatch in headless mode | disabled | the host session exits successfully after completing the phase transition without recording pending approval |

  @plan-implementability.NTB1.K3EBHB.R7
  Rule: plan-implementability.NTB1.K3EBHB.R7 — Every planning block gives one plain recovery action

    Scenario: A contract mismatch message is useful without technical identifiers
      Given a non-technical builder encounters an edited planning contract
      When Safeword blocks the phase
      Then the primary message says what changed, why safe work stopped, and the one reconciliation action before showing optional digest details

    @surface.safeword-cli
    Scenario: Technical details remain available after the plain recovery action
      Given a technical builder encounters a planning block through the installed CLI path
      When the progressive-disclosure message is rendered
      Then the plain next action appears first and the failing check, artifact path, and digest remain available in optional details

  @plan-implementability.NTB1.K3EBHB.R8
  Rule: plan-implementability.NTB1.K3EBHB.R8 — Stale review messages name the meaningful change and affected plan

    Scenario Outline: Review invalidation names only the plans affected by a changed decision
      Given both plans were reviewed and hold current receipts
      When <change> is recorded
      Then <invalidation_result>

      Examples:
        | change | invalidation_result |
        | a shared authorization decision changes | the message names the authorization decision and says both plans need review again |
        | an Execution Plan-only sequencing decision changes | the message names the sequencing decision, says the Execution Plan needs review again, and preserves the Implementation Plan receipt |
        | only whitespace, comments, or formatting change without changing a decision's meaning | the message is not emitted and both plan receipts remain current |

  @plan-implementability.NTB1.K3EBHB.R9
  Rule: plan-implementability.NTB1.K3EBHB.R9 — Promotion messages preserve evidence and name the resume phase

    Scenario: Promotion reads as a continuation rather than lost work
      Given task TDD has a useful failing test and discovers an unresolved public-contract choice
      When Safeword promotes the work
      Then the message explains the choice, states that the failing test was preserved, and names the feature phase that resumes next

    Scenario: Promotion preserves the existing failing test artifact
      Given task TDD has a useful failing test and discovers an unresolved public-contract choice
      When Safeword promotes the work
      Then the resumed feature phase can run the same test and it still fails for the originally recorded reason

  @plan-implementability.NTB1.K3EBHB.R10
  Rule: plan-implementability.NTB1.K3EBHB.R10 — Non-technical walkthroughs prove recovery messages at real boundaries

    Scenario Outline: A non-technical builder can recover from each new message category
      Given a <message_category> condition is recorded for a non-technical builder without source-code access
      When Safeword renders the primary message for that condition
      Then a single-imperative check finds exactly one next action, <recovery>, and a fixed lexicon finds no internal phase identifiers, file paths, or digests in the primary message while permitting the plain-language resume phase

      Examples:
        | message_category | recovery |
        | missing input | regenerate the named missing planning input |
        | mismatched contract | reconcile the installed planning files |
        | stale review | rerun review for the named plan |
        | exhausted independent routes | continue with the permitted fallback whose actual route is named without calling completion degraded |
        | pending human approval | respond to the surfaced approach |
        | refused approach | revise the refused approach |
        | task promotion | resume at the named feature phase with existing evidence preserved |

    @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario Outline: Pending-approval recovery renders through each installed host boundary
      # The preceding surface-agnostic outline owns every category's exact message contract; this outline varies only host wiring.
      Given a non-technical builder without source-code access faces a pending human approval condition on <host>
      When <installed_entry> handles the condition with real configuration and collaborators
      Then the primary message names "respond to the surfaced approach" as the one plain-language next action and leaves technical identifiers to optional details

      Examples:
        | host | installed_entry |
        | Safeword CLI | actual installed CLI dispatch |
        | Claude Code | actual lifecycle dispatch from installed project hooks |
        | OpenAI Codex | actual lifecycle dispatch from installed project hooks |
        | OpenCode CLI | actual lifecycle dispatch from the installed profile plugin |
        | Cursor | actual lifecycle dispatch from installed project hooks |

    @surface.claude-code
    Scenario: Installed recovery selection changes with the actual condition
      Given a stale review condition is recorded for a non-technical builder without source-code access on Claude Code
      When actual lifecycle dispatch from installed project hooks handles the condition with real configuration and collaborators
      Then the primary message names "rerun review for the named plan" as the one plain-language next action and does not name approval recovery

    @surface.claude-code-cloud @surface.cursor-cloud-agents
    Scenario Outline: Recovery messages remain plain at cloud host boundaries
      Given a non-technical builder without source-code access faces a pending human approval condition on <cloud_host>
      When <installed_entry> handles the condition with real configuration and collaborators
      Then the primary message names "respond to the surfaced approach" as the one plain-language next action and leaves technical identifiers to optional details

      Examples:
        | cloud_host | installed_entry |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner |

    @rejection
    Scenario: Jargon-only recovery text fails the walkthrough
      Given a non-technical builder receives only internal phase identifiers and digest details for a planning block
      When the recovery message is checked
      Then the fixed jargon lexicon makes the walkthrough fail

    @rejection
    Scenario: Competing recovery actions fail the walkthrough
      Given a non-technical builder receives a primary message offering two different next actions
      When the recovery message is checked
      Then the single-imperative check makes the walkthrough fail

    @surface.opencode
    Scenario: OpenCode Desktop names its limitation and authoritative route
      Given a non-technical builder reaches OpenCode Desktop
      When planning guidance is rendered
      Then it says approval is not enforced there and names the enforced OpenCode CLI and TUI route as the one next action

    # skip: Codex Cloud is outside this ticket's affected surfaces and its advisory guidance is owned by 5F5ZZA R8.
