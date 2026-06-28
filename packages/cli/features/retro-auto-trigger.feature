@retro-auto-trigger @manual
Feature: retro auto-trigger (Claude-first)

  A stop-retro.ts Claude Code Stop hook fires the retro pipeline at most once per
  substantial session, while the session is alive, via a fact-phrased nudge.
  Tagged @manual: proven by vitest unit tests, excluded from the cucumber lane
  (no step definitions), matching the sibling retro-transcript-mining feature.

  Rule: The substance gate discriminates real work from trivial sessions (SM1.AC1, SM1.AC2)

    @retro-auto-trigger.SM1.AC2
    Scenario Outline: The substance decision flips at the threshold (inclusive)
      Given a transcript whose tool-use count is <count> the substance threshold
      When the substance gate evaluates it
      Then the session is judged <verdict>

      Examples:
        | count          | verdict         |
        | below          | not substantial |
        | exactly at     | substantial     |
        | above          | substantial     |

  Rule: Fires once on a substantial session (SM1.AC1)

    @retro-auto-trigger.SM1.AC1
    Scenario: A substantial session surfaces one nudge carrying the path and guide
      Given a Stop hook fires with a transcript the substance gate judges substantial
      And the session has not been nudged before
      When the hook runs
      Then the output is Stop hookSpecificOutput.additionalContext
      And the surfaced nudge contains the supplied transcript path
      And the surfaced nudge points at the retro guide

  Rule: Stays silent on a trivial session (SM1.AC2)

    @retro-auto-trigger.SM1.AC2
    Scenario: A session the gate judges trivial surfaces no nudge
      Given a Stop hook fires with a transcript the substance gate judges not substantial
      When the hook runs
      Then it surfaces no nudge
      And it leaves the once-per-session sentinel unset

  Rule: Never nudges twice in one session (SM1.AC3)

    @retro-auto-trigger.SM1.AC3
    Scenario: A second Stop for the same session stays silent because the sentinel is set
      Given a substantial session whose once-per-session sentinel is already set
      When the hook runs again for the same session id
      Then it surfaces no nudge

    @retro-auto-trigger.SM1.AC3
    Scenario: A different session id still nudges (the sentinel is keyed by session id)
      Given one session has already set its once-per-session sentinel
      And a Stop hook fires with a substantial transcript for a different session id
      When the hook runs
      Then the output is Stop hookSpecificOutput.additionalContext

  Rule: Runs while the session is alive, cloud-safe (SM1.AC4)

    @retro-auto-trigger.SM1.AC4
    Scenario Outline: The session id resolves by precedence (input > cloud > local)
      Given the hook input session_id is <input>
      And the cloud session id in the environment is <cloud>
      And the local session id in the environment is <local>
      When the hook resolves the session id
      Then the once-per-session sentinel is keyed to <expected>

      Examples:
        | input    | cloud    | local    | expected |
        | sess-in  | sess-cl  | sess-lo  | sess-in  |
        | (absent) | sess-cl  | sess-lo  | sess-cl  |
        | (absent) | (absent) | sess-lo  | sess-lo  |

    @retro-auto-trigger.SM1.AC4
    Scenario: The hook reads the supplied transcript path and never guesses one
      Given a Stop hook input whose transcript_path points at a substantial transcript
      When the hook runs
      Then it reads the transcript at the supplied path
      And it constructs no path from the home directory or environment

  Rule: The nudge is a fact, not a command (TB1.AC1)

    @retro-auto-trigger.TB1.AC1
    Scenario: The surfaced nudge contains no imperative command to the agent
      Given a Stop hook fires with a substantial transcript
      When the hook runs
      Then the surfaced nudge contains no imperative command to the agent

  Rule: The hook never breaks the turn (TB1.AC2)

    @retro-auto-trigger.TB1.AC2
    Scenario Outline: A malformed or unreadable input fails open
      Given a Stop hook is invoked with <bad-input>
      When the hook runs
      Then it exits zero
      And it emits no blocking decision so Stop proceeds
      And it leaves the once-per-session sentinel unset

      Examples:
        | bad-input                                          |
        | stdin that is not valid JSON                       |
        | an input with no transcript_path                   |
        | a transcript_path pointing at an unreadable file   |
