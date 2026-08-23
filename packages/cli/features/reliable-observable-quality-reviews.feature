@proof.vitest
Feature: Keep quality reviews observable and actionable

  Safeword-managed independent reviews should remain visibly active during long
  reviewer work without corrupting the typed result consumed by agents and
  automation. The installed wrapper opts JSON review children into this private
  side channel; direct JSON callers remain silent by default.

  Executable proof: packages/cli/tests/cli-protocol/review-wiring.test.ts,
  packages/cli/tests/cli-protocol/policy.test.ts,
  packages/cli/tests/review/surface-parity.test.ts, and
  packages/cli/tests/review/environment.test.ts.

  @reliable-observable-quality-reviews.TBU1.R1 @surface.safeword-cli
  Rule: reliable-observable-quality-reviews.TBU1.R1 — Managed JSON reviews expose reviewer activity without changing verdict results

    Scenario Outline: Managed progress preserves each reviewer verdict outcome
      Given a managed JSON review remains active through a waiting heartbeat
      When the reviewer returns verdict <verdict>
      Then stderr reports active reviewer work
      And stderr reports a waiting heartbeat
      And stdout is one parseable schema-1 result classified as <classification>
      And the command exits with status <status>

      Examples:
        | verdict         | classification  | status |
        | approve         | approved        | 0      |
        | request_changes | action-required | 2      |

    Scenario: Waiting heartbeat respects its interval and repeats
      Given a managed review has armed a waiting heartbeat on a controlled scheduler
      When the scheduler advances to just before 30 seconds
      And then advances through 30 and 60 seconds while the review remains incomplete
      Then no waiting heartbeat is emitted before 30 seconds
      And one waiting heartbeat is emitted at 30 and 60 seconds
      And another heartbeat is armed for 90 seconds

    Scenario Outline: Active route progress identifies the assigned reviewer
      Given a managed JSON review assigns the active route to <assigned>
      When lifecycle progress is emitted
      Then stderr identifies <assigned> as the assigned reviewer
      And stderr does not identify <other> as the assigned reviewer

      Examples:
        | assigned | other  |
        | Codex    | Claude |
        | Claude   | Codex  |

    Scenario: Completion cancels pending lifecycle output
      Given a managed review has armed active and heartbeat reports that emit when it remains incomplete
      When the review completes before those reports are due
      And the controlled scheduler advances past both due points
      Then no pending lifecycle report is emitted afterward

  @reliable-observable-quality-reviews.TBU1.R2 @surface.safeword-cli
  Rule: reliable-observable-quality-reviews.TBU1.R2 — Unsupported callers retain the existing machine and human contracts

    Scenario Outline: Only the exact private signal enables JSON progress
      Given a JSON review with managed-progress signal value <value>
      When output policy is resolved
      Then managed JSON progress is <enabled>
      And the private signal is removed from the command environment

      Examples:
        | value   | enabled  |
        | "1"     | enabled  |
        | <unset> | disabled |
        | ""      | disabled |
        | " "     | disabled |
        | "0"     | disabled |
        | "01"    | disabled |
        | "1 "    | disabled |
        | "true"  | disabled |
        | "TRUE"  | disabled |

    Scenario Outline: Quiet mode wins over managed progress
      Given a managed JSON review remains active through a waiting heartbeat with quiet mode enabled
      When the reviewer returns verdict <verdict>
      Then stderr is empty
      And stdout is one parseable schema-1 result classified as <classification>
      And the command exits with status <status>

      Examples:
        | verdict         | classification  | status |
        | approve         | approved        | 0      |
        | request_changes | action-required | 2      |

    Scenario: A direct JSON review remains silent without the private signal
      Given a direct JSON review remains active through a waiting heartbeat without the private signal
      When the reviewer returns an approved result
      Then stderr is empty
      And stdout is one parseable schema-1 result classified as approved
      And the command exits with status 0

    Scenario: Human-readable progress remains enabled with the private signal
      Given a human-readable review without quiet mode carries the private signal
      When output policy is resolved
      Then human-readable progress remains enabled
      And the private signal is removed from the command environment

  @reliable-observable-quality-reviews.SWM1.R1 @surface.safeword-cli
  Rule: reliable-observable-quality-reviews.SWM1.R1 — Progress writes do not throw and the private signal does not reach reviewers

    Scenario Outline: Progress write failures remain best-effort and retryable
      Given a managed progress destination where <outcomes>
      When exactly two lifecycle writes are attempted
      Then the caller observes no thrown write error
      And the non-failing write is delivered

      Examples:
        | outcomes                                  |
        | the first write fails and the second succeeds |
        | the first write succeeds and the second fails |

    Scenario: The reviewer allowlist excludes the wrapper-only signal
      Given a managed JSON review carries the private signal and an allowed `PATH` value
      When the public CLI constructs a reviewer environment
      Then the reviewer environment preserves that `PATH` value
      And the reviewer environment does not contain the private signal

  @reliable-observable-quality-reviews.SWM1.R2 @surface.safeword-cli @surface.claude-code @surface.openai-codex
  Rule: reliable-observable-quality-reviews.SWM1.R2 — Required-review workflows enter the managed coordinator through compatible host routes

    Scenario: The wrapper scopes progress to its JSON review child
      Given the wrapper inherits a hostile private-signal value and selects a JSON review child that waits for acknowledgement
      When it probes candidates and launches a JSON review
      Then probes receive no private signal
      And the selected JSON review child receives the exact private signal
      And progress reaches stderr before the child is acknowledged
      And the child writes `RESULT` to stdout and exits with status 2

    Scenario Outline: The wrapper remains compatible with an older review-capable CLI
      Given an older CLI rejects unknown arguments and ignores unknown environment variables
      When the wrapper launches a JSON review returning <classification>
      Then no managed-progress argument is passed
      And the CLI result and status <status> are preserved

      Examples:
        | classification  | status |
        | approved        | 0      |
        | action-required | 2      |

    Scenario: Required-review surfaces cannot bypass the review coordinator
      Given non-empty catalogues of workflows required to launch independent reviews for Claude Code and OpenAI Codex and a non-empty Cursor catalogue
      When independent-review launch commands are inspected
      Then required Claude Code workflows invoke the wrapper with JSON output
      And required OpenAI Codex workflows invoke the pinned CLI with JSON output and managed progress
      And no required workflow invokes a reviewer directly
      And the inspected Cursor catalogue is non-empty and contains no independent-review launch command
