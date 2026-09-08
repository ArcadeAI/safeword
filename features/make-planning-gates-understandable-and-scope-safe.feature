Feature: Make planning gates understandable and scope-safe
  Safeword keeps review inside accepted scope and gives builders one plain recovery action.

  @plan-implementability.NTB1.K3EBHB.R1
  Rule: plan-implementability.NTB1.K3EBHB.R1 — Accepted scope combines every binding boundary

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    @rejection
    Scenario Outline: A plan cannot ignore any binding scope source
      Given a plan conflicts with <scope_source>
      When the accepted boundary is resolved
      Then that source remains binding and the conflicting work cannot enter the plan

      Examples:
        | scope_source |
        | the ticket's scope or out-of-scope choices |
        | a project non-goal |
        | a milestone non-goal |
        | an inherited parent boundary |

  @plan-implementability.NTB1.K3EBHB.R2
  Rule: plan-implementability.NTB1.K3EBHB.R2 — Completeness is checked for omission and overreach

    @rejection
    Scenario Outline: Missing and extra work both fail completeness
      Given a plan <scope_defect>
      When scope completeness is reviewed
      Then approval is blocked with that mismatch named against the accepted boundary

      Examples:
        | scope_defect |
        | omits an accepted obligation |
        | adds an unapproved capability |

  @plan-implementability.NTB1.K3EBHB.R3
  Rule: plan-implementability.NTB1.K3EBHB.R3 — Reviewers correct false clearance without expanding scope

    @rejection
    Scenario Outline: Reviewer correction follows the accepted boundary
      Given a reviewer finds <review_finding>
      When the verdict is produced
      Then <review_outcome>

      Examples:
        | review_finding | review_outcome |
        | an in-scope false clearance | correction is required before approval |
        | an out-of-scope resilience improvement | the improvement is nonblocking and cannot be added without user authority |

  @plan-implementability.NTB1.K3EBHB.R4
  Rule: plan-implementability.NTB1.K3EBHB.R4 — User-declined strengthening is recorded and re-reviewed

    @rejection
    Scenario: Declining optional scope does not waive review of the accepted boundary
      Given a user declines a nonblocking strengthening proposal
      When the unchanged plan is resubmitted
      Then the decline is recorded and the plan is reviewed again only against the resolved accepted boundary

  @plan-implementability.NTB1.K3EBHB.R5
  Rule: plan-implementability.NTB1.K3EBHB.R5 — Guidance cannot expand accepted scope

    @rejection
    Scenario Outline: An externally suggested capability remains outside the plan
      Given <source> suggests a capability outside the accepted boundary
      When the Implementation Plan is authored
      Then the capability remains outside the plan unless the user explicitly expands scope

      Examples:
        | source |
        | applicable project guidance |
        | current external research |

  @plan-implementability.NTB1.K3EBHB.R6
  Rule: plan-implementability.NTB1.K3EBHB.R6 — Human design approval occurs once on the approach

    @rejection
    Scenario Outline: Approval-gate behavior differs only by user availability
      Given the human design-approval gate is <setting> in a <session> session
      When the reviewed Implementation Plan is ready to leave its phase
      Then <outcome>

      Examples:
        | setting | session | outcome |
        | disabled | interactive | Execution Planning begins without a prompt |
        | enabled | interactive | Execution Planning waits for one human approach approval |
        | enabled | headless | pending approval is recorded, the approach is surfaced, and work does not deadlock |

  @plan-implementability.NTB1.K3EBHB.R7
  Rule: plan-implementability.NTB1.K3EBHB.R7 — Every planning block explains one recovery action plainly

    @rejection
    Scenario: A contract mismatch message is useful without technical identifiers
      Given a non-technical builder encounters an edited planning contract
      When Safeword blocks the phase
      Then the primary message says what changed, why safe work stopped, and the one reconciliation action before showing optional digest details

  @plan-implementability.NTB1.K3EBHB.R8
  Rule: plan-implementability.NTB1.K3EBHB.R8 — Stale-review messages name the meaningful change

    @rejection
    Scenario: Review invalidation names the changed decision and affected plan
      Given an accepted authorization decision changes after both plans were reviewed
      When Safeword invalidates the receipts
      Then the message names the authorization decision and says both plans need review again

  @plan-implementability.NTB1.K3EBHB.R9
  Rule: plan-implementability.NTB1.K3EBHB.R9 — Task promotion preserves progress and explains why

    @rejection
    Scenario: Promotion reads as a continuation rather than lost work
      Given task TDD has a useful failing test and discovers an unresolved public-contract choice
      When Safeword promotes the work
      Then the message explains the choice, preserves the failing test as evidence, and names the feature phase that resumes next

  @plan-implementability.NTB1.K3EBHB.R10
  Rule: plan-implementability.NTB1.K3EBHB.R10 — Recovery messages pass an NTB walkthrough

    @rejection
    Scenario Outline: A non-technical builder can recover from each new message category
      Given a non-technical builder sees a <message_category> message without source code
      When they identify what to do next
      Then they select <recovery> from the primary message alone

      Examples:
        | message_category | recovery |
        | missing contract | regenerate the installed planning files |
        | mismatched contract | reconcile the installed planning files |
        | stale review | rerun review for the named plan |
        | exhausted independent routes | continue with the honestly labeled permitted fallback |
        | task promotion | resume at the named feature phase with existing evidence preserved |
