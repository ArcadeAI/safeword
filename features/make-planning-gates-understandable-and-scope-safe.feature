Feature: Make planning gates understandable and scope-safe
  Safeword keeps review inside accepted scope and gives builders one plain recovery action.

  @plan-implementability.NTB1.K3EBHB.R1
  Rule: plan-implementability.NTB1.K3EBHB.R1 — Accepted scope combines ticket, project, milestone, and inherited boundaries

    @surface.safeword-cli
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

  @plan-implementability.NTB1.K3EBHB.R3
  Rule: plan-implementability.NTB1.K3EBHB.R3 — Reviewer corrections cannot silently expand scope

    @rejection
    Scenario: An in-scope false clearance blocks approval
      Given a reviewer finds an in-scope false clearance
      When the verdict is produced
      Then correction is required before approval

    Scenario: An out-of-scope improvement remains optional
      Given a reviewer finds an out-of-scope resilience improvement
      When the verdict is produced
      Then the improvement is nonblocking

  @plan-implementability.NTB1.K3EBHB.R4
  Rule: plan-implementability.NTB1.K3EBHB.R4 — Declined strengthening remains declined and reviewable

    @rejection
    Scenario: Declining optional scope does not waive review of the accepted boundary
      Given a user declines a nonblocking strengthening proposal
      When the unchanged plan is resubmitted
      Then the decline is recorded and the plan is reviewed again only against the resolved accepted boundary

    Scenario: Accepting optional scope records the authority that expanded it
      Given a reviewer proposes a nonblocking strengthening outside the accepted boundary
      When the user explicitly accepts it
      Then the accepted boundary expands with that user authority recorded and the revised plan is reviewed against it

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

  @plan-implementability.NTB1.K3EBHB.R6
  Rule: plan-implementability.NTB1.K3EBHB.R6 — Human design approval occurs once on the approach

    @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario Outline: Approval-gate behavior differs only by user availability
      Given the human design-approval gate is <setting> in a <session> session on an enforced local client, where OpenCode means CLI or TUI
      When the reviewed Implementation Plan is ready to leave its phase
      Then <outcome>

      Examples:
        | setting | session | outcome |
        | disabled | interactive | Execution Planning begins without a prompt |
        | enabled | interactive | Execution Planning waits for one human approach approval |
        | enabled | headless | the session exits with pending approval recorded, the approach surfaced, and Execution Planning not begun |

    Scenario: Approach approval is not requested twice when the approach is unchanged
      Given the approach was approved once and the Implementation Plan was revised without changing that approach
      When the plan re-enters the human design-approval gate
      Then no second approach approval is requested and the prior approval remains linked

    Scenario: A changed approach requires new approval
      Given the approach was approved once and the Implementation Plan was revised with a materially changed approach
      When the plan re-enters the human design-approval gate
      Then a new approach approval is requested and the prior approval no longer clears the gate

    @rejection
    Scenario: Refusing an approach keeps the same approach blocked
      Given the human design-approval gate is enabled and the user refused the presented approach
      When the unchanged approach is resubmitted
      Then Execution Planning remains blocked and the refusal remains linked to that approach

    @rejection
    Scenario: Only human authority can clear a pending approach approval
      Given a headless session recorded pending human approval for an approach
      When an agent-authored approval claim is presented without matching human authority
      Then Execution Planning remains blocked with human approval named as the next action

    @surface.claude-code-cloud @surface.cursor-cloud-agents @surface.openai-codex
    Scenario Outline: Headless approval exits cleanly through the real host lifecycle
      Given the human design-approval gate is enabled in <headless_host>
      When <host_entry> reaches the reviewed Implementation Plan's phase transition with real configuration and collaborators
      Then a condition-based harness observes successful process exit, pending approval recorded, the approach surfaced, and Execution Planning not begun without using a fixed delay

      Examples:
        | headless_host | host_entry |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner |
        | OpenAI Codex headless | actual installed local lifecycle dispatch in headless mode |

  @plan-implementability.NTB1.K3EBHB.R7
  Rule: plan-implementability.NTB1.K3EBHB.R7 — Every planning block gives one plain recovery action

    @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario: A contract mismatch message is useful without technical identifiers
      Given a non-technical builder encounters an edited planning contract
      When Safeword blocks the phase
      Then the primary message says what changed, why safe work stopped, and the one reconciliation action before showing optional digest details

  @plan-implementability.NTB1.K3EBHB.R8
  Rule: plan-implementability.NTB1.K3EBHB.R8 — Stale review messages name the meaningful change and affected plan

    @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario Outline: Review invalidation names only the plans affected by a changed decision
      Given an accepted <decision_scope> decision changes after both plans were reviewed
      When Safeword invalidates the receipts
      Then <invalidation_result>

      Examples:
        | decision_scope | invalidation_result |
        | shared authorization | the message names the authorization decision and says both plans need review again |
        | Execution Plan-only sequencing | the message names the sequencing decision, says the Execution Plan needs review again, and preserves the Implementation Plan receipt |

  @plan-implementability.NTB1.K3EBHB.R9
  Rule: plan-implementability.NTB1.K3EBHB.R9 — Promotion messages preserve evidence and name the resume phase

    @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario: Promotion reads as a continuation rather than lost work
      Given task TDD has a useful failing test and discovers an unresolved public-contract choice
      When Safeword promotes the work
      Then the message explains the choice, states that the failing test was preserved, and names the feature phase that resumes next

    Scenario: Promotion preserves the existing failing test artifact
      Given task TDD has a useful failing test and discovers an unresolved public-contract choice
      When Safeword promotes the work
      Then the same failing test artifact remains available to the resumed feature phase

  @plan-implementability.NTB1.K3EBHB.R10
  Rule: plan-implementability.NTB1.K3EBHB.R10 — Non-technical walkthroughs prove recovery messages at real boundaries

    @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario Outline: A non-technical builder can recover from each new message category
      Given a non-technical builder without source-code access faces a <message_category> condition
      When Safeword handles that condition through the installed host path and renders the primary message
      Then a single-imperative check finds exactly one next action, <recovery>, and a fixed lexicon finds no phase names, file paths, or digests

      Examples:
        | message_category | recovery |
        | missing contract | regenerate the installed planning files |
        | mismatched contract | reconcile the installed planning files |
        | stale review | rerun review for the named plan |
        | exhausted independent routes | continue with the honestly labeled permitted fallback |
        | task promotion | resume at the named feature phase with existing evidence preserved |

    @rejection
    Scenario: Jargon-only recovery text fails the walkthrough
      Given a non-technical builder receives only internal phase identifiers and digest details for a planning block
      When the recovery message is checked
      Then the fixed jargon lexicon makes the walkthrough fail

    # skip: Codex Cloud is outside this ticket's affected surfaces and its advisory guidance is owned by 5F5ZZA R8.
    @surface.opencode
    Scenario: OpenCode Desktop names its limitation and authoritative route
      Given a non-technical builder reaches OpenCode Desktop
      When planning guidance is rendered
      Then it says approval is not enforced there and names OpenCode CLI or TUI as the next action

    @surface.safeword-cli
    Scenario: Technical details remain available after the plain recovery action
      Given a technical builder encounters a planning block through the installed CLI path
      When the progressive-disclosure message is rendered
      Then the plain next action appears first and the failing check, artifact path, and digest remain available in optional details
