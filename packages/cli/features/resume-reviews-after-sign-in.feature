@manual @surface.openai-codex @surface.claude-code
# These narrative scenarios use Vitest integration proofs rather than Cucumber steps.
# Automated proof: real login child-process tests and signed-job MCP integration tests.
# Vendor authentication is simulated at the executable boundary; no live account is required.
# The fake stores authentication state under CLAUDE_CONFIG_DIR or CODEX_HOME, independently of HOME.
Feature: Resume independent reviews after sign-in
  @resume-reviews-after-sign-in.TBU1.R1
  Rule: resume-reviews-after-sign-in.TBU1.R1 — Resume one unchanged request
    Scenario Outline: Confirmed sign-in resumes the original review once
      Given a signed review needs <reviewer> authentication
      And its assigned credential profile and executable differ from the ambient defaults
      When login and the assigned-profile authentication check succeed
      Then the bounded review resumes without another human message
      And exactly one linked retry is dispatched
      And the retry reaches a terminal review verdict
      And the retry uses the captured reviewer executable and credential profile
      And its original signed receipt remains byte-identical
      And its retry links to that receipt

      Examples:
        | reviewer |
        | Claude   |
        | Codex    |

    Scenario Outline: Abandoned or unsuccessful login cannot resume work
      Given a signed review is waiting for sign-in
      And the assigned-profile authentication check would succeed unless the outcome is assigned-profile auth failure
      When <outcome> occurs
      Then no retry is dispatched

      Examples:
        | outcome                                     |
        | login fails                                 |
        | login succeeds but assigned-profile auth fails |
        | login is cancelled                          |

    Scenario: Expired sign-in cannot resume after late success
      Given an owned login is paused before otherwise successful login and assigned-profile authentication
      When a controlled clock reaches the ten-minute deadline before that success is released
      Then the owned login process terminates
      And releasing the late success creates no retry receipt

    Scenario: Confirmed sign-in just before expiry still resumes
      Given an owned login and its assigned-profile check are paused before success
      When that success is released at nine minutes and fifty-nine seconds on a controlled clock
      Then exactly one linked retry reaches a terminal verdict

    Scenario Outline: The original request must still match before dispatch
      Given a signed review is waiting for sign-in
      When login and the assigned-profile authentication check succeed after <change>
      Then no retry is dispatched

      Examples:
        | change                            |
        | target contents change at the same paths |
        | context contents change           |
        | review policy changes             |
        | assigned reviewer changes         |
        | the signed receipt is tampered    |

    Scenario: Concurrent completion cannot duplicate reviews
      Given successful login and assigned-profile authentication belong to a signed blocked review
      When two completions arrive concurrently
      Then exactly one linked retry attempt is dispatched
      And both completions identify that same attempt
      And that attempt reaches a terminal verdict

    Scenario: A later completion returns the existing attempt
      Given successful sign-in has already dispatched a linked retry
      When the same login completion arrives again
      Then it identifies the existing retry without dispatching another attempt

    Scenario: Authentication in another profile cannot resume work
      Given the default profile is authenticated but the assigned profile is unauthenticated
      And a signed review is waiting for assigned-profile sign-in
      When login exits successfully but the assigned-profile check fails
      Then no retry is dispatched

    Scenario Outline: Server shutdown terminates owned login processes
      Given a signed review has an active owned process at the <stage> stage
      When <shutdown> occurs
      Then the owned <stage> process terminates
      And no retry receipt exists and the reviewer executable has not reviewed files

      Examples:
        | shutdown | stage                |
        | MCP EOF  | login                |
        | SIGTERM  | login                |
        | MCP EOF  | authentication check |
        | SIGTERM  | authentication check |

    Scenario: Closing the optional panel does not cancel continuation
      Given a signed review is waiting for sign-in with its panel closed
      And the MCP connection remains open
      When login and the assigned-profile check succeed
      Then exactly one linked retry reaches a terminal verdict

    Scenario: A source change during authentication prevents dispatch
      Given an authentication check is paused at a controlled fixture barrier
      And its signed review initially matches the source files
      When the target changes before the successful check is released
      Then no retry is dispatched

    Scenario Outline: Status observes recovery without starting work
      Given a signed review is <stage>
      When its original status is queried
      Then it reports <expected>
      And no receipt is written and no process is started or terminated

      Examples:
        | stage                          | expected                               |
        | waiting for sign-in            | the original authentication requirement |
        | running its linked retry       | the linked attempt as pending          |
        | finished with its linked retry | the linked attempt's terminal verdict  |

    Scenario: Sign-in guidance explains automatic continuation
      Given a signed review is eligible for automatic recovery
      When its sign-in information is displayed
      Then its text and optional panel explain that the review resumes automatically while connected

    Scenario: A second authentication failure stops recovery
      Given confirmed sign-in triggered one retry
      When the retry reports authentication required again
      Then no further login or retry starts automatically
      And original status reports the linked attempt's authentication requirement

    Scenario: Legacy receipts keep manual retry guidance
      Given a signed authentication-blocked receipt has no credential-profile binding
      When its sign-in information is displayed
      Then guidance asks for a manual retry without promising automatic resumption
