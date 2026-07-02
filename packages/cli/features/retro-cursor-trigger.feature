@retro-cursor-trigger @manual
Feature: retro auto-trigger — Cursor

  A retro path in cursor/stop.ts fires the retro pipeline once per substantial
  Cursor session via a followup_message, counting tool_use from the hook-provided
  transcript_path (Claude-shaped). Reuses the shared core; coexists with the
  existing quality-review followup. Tagged @manual — proven by vitest, excluded
  from the cucumber lane (no step defs).

  Rule: Reuses the Claude-shaped tool-use counter on the Cursor transcript (SM1.AC1)

    @retro-cursor-trigger.SM1.AC1
    Scenario: The Claude-shaped counter counts tool_use blocks in a Cursor transcript
      Given a Cursor transcript with three message.content tool_use blocks
      When the tool-use counter evaluates it
      Then the counted tool-use total is 3

    @retro-cursor-trigger.SM1.AC1
    Scenario Outline: A Cursor transcript is substantial at or above the threshold (inclusive)
      Given a Cursor transcript whose tool_use count is <count> the substance threshold
      When the substance gate evaluates it
      Then the session is judged <verdict>

      Examples:
        | count      | verdict         |
        | one below  | not substantial |
        | exactly at | substantial     |
        | above      | substantial     |

  Rule: Fires once on a substantial Cursor session via followup_message (SM1.AC1)

    @retro-cursor-trigger.SM1.AC1
    Scenario: A substantial completed Cursor session emits a retro followup with path and guide
      Given a Cursor stop payload with status completed and a substantial transcript
      And the session has not been nudged before
      When the adapter runs
      Then the output has a followup_message
      And the followup_message contains the transcript path
      And the followup_message points at the retro guide

    @retro-cursor-trigger.SM1.AC1
    Scenario: A trivial completed Cursor session emits no retro followup
      Given a Cursor stop payload with status completed and a below-threshold transcript
      And no quality-review followup fires this stop
      When the adapter runs
      Then the output has no retro followup
      And the output is empty

  Rule: Idempotent and cloud-safe, reusing the shared core (SM1.AC2)

    @retro-cursor-trigger.SM1.AC2
    Scenario: The Cursor session id resolves from conversation_id
      Given a Cursor stop payload supplying the session id via conversation_id
      When the adapter resolves the session id
      Then the once-per-session sentinel is keyed to that id

    @retro-cursor-trigger.SM1.AC2
    Scenario: An absent conversation id does not fire
      Given a Cursor stop payload with no conversation_id and a substantial transcript
      When the adapter runs
      Then the output has no retro followup
      And it leaves the once-per-session sentinel unset

    @retro-cursor-trigger.SM1.AC2
    Scenario: A second stop for the same Cursor session does not fire retro again
      Given a substantial Cursor session whose once-per-session sentinel is already set
      When the adapter runs again for the same conversation id
      Then the output has no retro followup

    @retro-cursor-trigger.SM1.AC2
    Scenario: A different conversation id still fires (sentinel keyed by session id)
      Given one Cursor session has already set its once-per-session sentinel
      And a Cursor stop payload with a substantial transcript for a different conversation id
      When the adapter runs
      Then the output has a followup_message
      And the first session's sentinel is left set

    @retro-cursor-trigger.SM1.AC2
    Scenario: The adapter reads the supplied transcript_path and never guesses one
      Given a Cursor stop payload whose transcript_path points at a substantial transcript
      When the adapter runs
      Then it reads the transcript at the supplied path
      And it constructs no path from the home directory or environment

  Rule: Coexists with the existing quality-review followup (SM1.AC3)

    @retro-cursor-trigger.SM1.AC3
    Scenario: When the quality-review followup fires, retro yields without consuming its sentinel
      Given a Cursor stop where the quality-review followup fires
      And a substantial transcript whose session has not been nudged
      When the adapter runs
      Then the output's followup_message is the quality-review message
      And the once-per-session retro sentinel is left unset

    @retro-cursor-trigger.SM1.AC3
    Scenario: Retro fires on a later non-review stop after quality-review took an earlier one
      Given a substantial Cursor session whose retro sentinel was left unset by an earlier quality-review stop
      And no quality-review followup fires this stop
      When the adapter runs
      Then the output has a followup_message
      And the followup_message points at the retro guide

  Rule: Fails open and respects non-completion (TB1.AC1)

    @retro-cursor-trigger.TB1.AC1
    Scenario: A non-completed status emits no retro followup and leaves the sentinel unset
      Given a Cursor stop payload with status aborted and a substantial transcript
      When the adapter runs
      Then the output has no retro followup
      And it leaves the once-per-session sentinel unset

    @retro-cursor-trigger.TB1.AC1
    Scenario Outline: A malformed or unreadable input fails open
      Given a Cursor stop adapter invoked with <bad-input>
      When the adapter runs
      Then the output has no retro followup
      And it leaves the once-per-session sentinel unset

      Examples:
        | bad-input                                          |
        | stdin that is not valid JSON                       |
        | a payload with no transcript_path                  |
        | a transcript_path pointing at an unreadable file   |
