@retro-codex-trigger @manual
Feature: retro auto-trigger — Codex

  A codex/stop.ts adapter fires the retro pipeline once per substantial Codex
  session via a {decision:"block"} continuation, counting Codex rollout tool
  events. Reuses the shared sentinel + resolver + orchestration from FTCQGD;
  only the tool-use counter and the output shape are Codex-specific.
  Tagged @manual — proven by vitest, excluded from the cucumber lane (no step defs).

  Rule: Counts Codex tool events, not Claude tool_use (SM1.AC1)

    @retro-codex-trigger.SM1.AC1
    Scenario Outline: Codex rollout events count as tool use only when they are tool events
      Given a Codex rollout containing one <event> event
      When the Codex tool-use counter evaluates it
      Then the counted tool-use total is <count>

      Examples:
        | event              | count |
        | function_call      | 1     |
        | exec_command_begin | 1     |
        | mcp_tool_call_begin| 1     |
        | agent_reasoning    | 0     |
        | token_count        | 0     |

    @retro-codex-trigger.SM1.AC1
    Scenario: A malformed rollout line is skipped, not counted or thrown
      Given a Codex rollout with one function_call event and one malformed line
      When the Codex tool-use counter evaluates it
      Then the counted tool-use total is 1

  Rule: The Codex substance decision flips at the threshold (SM1.AC1, SM1.AC2)

    @retro-codex-trigger.SM1.AC1
    Scenario Outline: A Codex rollout is substantial at or above the threshold (inclusive)
      Given a Codex rollout whose tool-event count is <count> the substance threshold
      When the substance gate evaluates it with the Codex counter
      Then the session is judged <verdict>

      Examples:
        | count      | verdict         |
        | one below  | not substantial |
        | exactly at | substantial     |
        | above      | substantial     |

  Rule: Fires once on a substantial Codex session via a continuation (SM1.AC2)

    @retro-codex-trigger.SM1.AC2
    Scenario: A substantial Codex session emits a block-continuation with path and guide
      Given a Codex Stop payload whose transcript_path points at a substantial rollout
      And the session has not been nudged before
      When the adapter runs
      Then the output decision is block
      And the continuation reason contains the transcript path
      And the continuation reason points at the retro guide

    @retro-codex-trigger.SM1.AC2
    Scenario: A Codex rollout below the threshold is judged trivial and emits no block
      Given a Codex Stop payload whose rollout has a Codex tool-event count below the threshold
      When the adapter runs
      Then the output is valid JSON
      And the output has no block decision

    @retro-codex-trigger.SM1.AC1
    Scenario: A rollout of Claude-shaped tool_use lines counts zero Codex tool events and does not fire
      Given a Codex Stop payload whose transcript_path points at a rollout of Claude-shaped tool_use lines
      When the adapter runs
      Then the output has no block decision

  Rule: Idempotent and cloud-safe, reusing the shared core (SM1.AC3)

    @retro-codex-trigger.SM1.AC3
    Scenario: A second Stop for the same Codex session does not continue again
      Given a substantial Codex session whose once-per-session sentinel is already set
      When the adapter runs again for the same session id
      Then the output has no block decision

    @retro-codex-trigger.SM1.AC3
    Scenario: A different Codex session id still fires (sentinel keyed by session id)
      Given one Codex session has already set its once-per-session sentinel
      And a Codex Stop payload with a substantial rollout for a different session id
      When the adapter runs
      Then the output decision is block
      And the first session's sentinel is left set

    @retro-codex-trigger.SM1.AC3
    Scenario Outline: The Codex session id resolves from the payload or environment
      Given a Codex Stop payload and environment supplying the session id via <source>
      When the adapter resolves the session id
      Then the once-per-session sentinel is keyed to that id

      Examples:
        | source           |
        | turn_id          |
        | CODEX_THREAD_ID  |
        | session_id       |

  Rule: Fails open with valid JSON, never breaking the Codex turn (TB1.AC1)

    @retro-codex-trigger.TB1.AC1
    Scenario Outline: A malformed or unreadable input fails open with valid JSON
      Given a Codex Stop adapter invoked with <bad-input>
      When the adapter runs
      Then the output is valid JSON
      And the output has no block decision
      And it exits zero
      And it leaves the once-per-session sentinel unset

      Examples:
        | bad-input                                          |
        | stdin that is not valid JSON                       |
        | a payload with no transcript_path                  |
        | a transcript_path pointing at an unreadable file   |

  Rule: The Claude path is unchanged by the counter refactor (TB1.AC2)

    @retro-codex-trigger.TB1.AC2
    Scenario: The Claude counter still counts Claude tool_use after the seam refactor
      Given a Claude transcript with three tool_use content items
      When the substance gate evaluates it with the Claude counter
      Then the counted tool-use total is 3
