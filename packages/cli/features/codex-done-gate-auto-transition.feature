@codex-done-gate @manual
Feature: Codex completes tickets after evidence passes

  Codex should carry a verified ticket through the same ticket lifecycle that
  the ready-PR guard requires, without manufacturing a second status-only commit.

  Rule: A verified session-bound ticket completes in the Codex Stop lifecycle

    @codex-done-gate.TBU1.R1 @rejection @surface.openai-codex @surface.safeword-cli
    Scenario: Valid done evidence completes only the session-bound ticket
      Given a Codex session is bound to an in-progress done-phase ticket
      And the ticket has passing shared done evidence
      When the Codex Stop hook runs
      Then that ticket has status and phase done
      And no other in-progress ticket changes state

    @codex-done-gate.TBU1.R1 @surface.openai-codex
    Scenario: Desktop PostToolUse fallback binds the ticket that Stop evaluates
      Given a Codex Desktop PostToolUse event omits its session identifier
      And its hook process has a stable Codex thread identifier
      And it edits an in-progress done-phase ticket with passing shared done evidence
      When the Codex PostToolUse hook runs and that thread's Stop hook runs
      Then that ticket has status and phase done

    @codex-done-gate.TBU1.R1 @rejection @surface.openai-codex
    Scenario Outline: A noneligible ticket is never closed as a fallback
      Given <ticket binding and state>
      And another ticket is in progress at done phase
      When the Codex Stop hook runs
      Then neither ticket changes state

      Examples:
        | ticket binding and state |
        | no Codex session is bound to a ticket |
        | a bound ticket is in implement phase |
        | a bound ticket is already done |

  Rule: Incomplete evidence cannot silently complete work

    @codex-done-gate.TBU1.R2 @rejection @surface.openai-codex
    Scenario Outline: Failed done evidence blocks the transition
      Given a Codex session is bound to an in-progress done-phase ticket
      And the ticket has <missing evidence>
      When the Codex Stop hook runs
      Then the ticket remains in progress at done phase
      And the hook emits `decision: "block"` whose reason exactly equals the shared evidence remediation
      And the response contains no architecture or filing continuation

      Examples:
        | missing evidence |
        | no verify artifact |
        | failed PR scope |
        | incomplete feature scenarios |
        | dependencies not ready |
        | failed test execution |

  Rule: Completion keeps the surrounding Stop lifecycle intact

    @codex-done-gate.SWM1.R1 @rejection @surface.openai-codex
    Scenario: A successful transition still returns the architecture advisory
      Given a Codex session is bound to an in-progress done-phase ticket
      And the ticket has passing shared done evidence
      And the project architecture advisory is due
      When the Codex Stop hook runs
      Then the ticket has status and phase done
      And the hook emits the architecture advisory continuation

    @codex-done-gate.SWM1.R1 @rejection @surface.openai-codex
    Scenario: Failed evidence wins over a pending retro filing continuation
      Given a Codex session is bound to an in-progress done-phase ticket
      And the ticket has no verify artifact
      And the session has an unfiled retro draft
      When the Codex Stop hook runs
      Then the ticket remains in progress at done phase
      And the hook emits `decision: "block"` whose reason exactly equals the missing-verify remediation
      And the response contains no filing continuation

    @codex-done-gate.SWM1.R1 @rejection @surface.openai-codex
    Scenario: Failed evidence wins over an architecture advisory
      Given a Codex session is bound to an in-progress done-phase ticket
      And the ticket has no verify artifact
      And the project architecture advisory is due
      When the Codex Stop hook runs
      Then the ticket remains in progress at done phase
      And the hook emits `decision: "block"` whose reason exactly equals the missing-verify remediation
      And the response contains no architecture continuation

    @codex-done-gate.SWM1.R1 @rejection @surface.openai-codex
    Scenario: Failed evidence still runs retro extraction before blocking
      Given a Codex session is bound to an in-progress done-phase ticket
      And the ticket has no verify artifact
      And the session has a readable substantial Codex rollout
      And child extraction returns an unfiled retro draft
      When the Codex Stop hook runs
      Then the draft is recorded in the session spool before the hook returns its block response
      And the retro child observed the ticket in progress at done phase
      And the ticket remains in progress at done phase
      And the hook emits `decision: "block"` whose reason exactly equals the missing-verify remediation
      And the response contains no filing or architecture continuation

    @codex-done-gate.SWM1.R1 @rejection @surface.openai-codex
    Scenario: Successful completion returns the pending filer continuation
      Given a Codex session is bound to an in-progress done-phase ticket
      And the ticket has passing shared done evidence
      And the session has an unfiled retro draft
      And the project architecture advisory is not due
      When the Codex Stop hook runs
      Then the ticket has status and phase done
      And the hook emits the filing continuation

    @codex-done-gate.SWM1.R1 @rejection @surface.openai-codex
    Scenario: Successful completion runs retro extraction before the transition
      Given a Codex session is bound to an in-progress done-phase ticket
      And the ticket has passing shared done evidence
      And the session has a readable substantial Codex rollout
      And the retro child records the bound ticket lifecycle before returning
      When the Codex Stop hook runs
      Then the retro child observed the ticket in progress at done phase
      And the ticket has status and phase done

    @codex-done-gate.SWM1.R1 @rejection @surface.openai-codex
    Scenario: Successful completion keeps architecture ahead of filing
      Given a Codex session is bound to an in-progress done-phase ticket
      And the ticket has passing shared done evidence
      And the session has an unfiled retro draft
      And the project architecture advisory is due
      When the Codex Stop hook runs
      Then the ticket has status and phase done
      And the hook emits the architecture advisory continuation instead of filing

    @codex-done-gate.SWM1.R1 @rejection @surface.openai-codex
    Scenario: An unbound session retains the architecture advisory without a transition
      Given no Codex session is bound to a ticket
      And another ticket is in progress at done phase
      And the project architecture advisory is due
      When the Codex Stop hook runs
      Then the global done-phase ticket remains in progress
      And the hook emits the architecture advisory continuation

    @codex-done-gate.SWM1.R2 @rejection @surface.openai-codex
    Scenario: Completion changes no Git ownership state
      Given a Codex session is bound to an in-progress done-phase ticket
      And the ticket has passing shared done evidence
      When the Codex Stop hook runs
      Then only the ticket lifecycle fields are changed by the completion path
      And the hook does not stage or commit files
