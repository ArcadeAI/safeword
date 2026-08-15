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
  Rule: reliable-observable-quality-reviews.TBU1.R1 — Managed JSON reviews expose reviewer activity without changing their result

    Scenario Outline: Managed progress preserves each terminal review outcome
      Given a managed JSON review remains active through a waiting heartbeat
      When the reviewer returns verdict <verdict>
      Then stderr reports active reviewer work and a waiting heartbeat
      And stdout is one parseable schema-1 result classified as <classification>
      And the command exits with status <status>

      Examples:
        | verdict         | classification  | status |
        | approve         | approved        | 0      |
        | request_changes | action-required | 2      |

    Scenario: Active route progress identifies the assigned reviewer
      Given a managed JSON review reaches an active reviewer route
      When lifecycle progress is emitted
      Then stderr identifies the assigned reviewer

    Scenario: Completion cancels pending lifecycle output
      Given a managed review has pending active and heartbeat reports
      When the review completes before those reports are due
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
      Given a managed JSON review with quiet mode enabled
      When the reviewer returns verdict <verdict>
      Then stderr is empty
      And stdout is one parseable schema-1 result
      And the command exits with status <status>

      Examples:
        | verdict         | status |
        | approve         | 0      |
        | request_changes | 2      |

    Scenario: Human-readable progress remains enabled without the private signal
      Given a human-readable review without quiet mode
      When output policy is resolved
      Then human-readable progress remains enabled

  @reliable-observable-quality-reviews.SWM1.R1 @surface.safeword-cli
  Rule: reliable-observable-quality-reviews.SWM1.R1 — Progress is a best-effort Safeword-owned side channel

    Scenario Outline: Progress write failures stay contained and retryable
      Given a managed progress destination that <failure>
      When lifecycle output is attempted more than once
      Then every write failure is swallowed
      And later lifecycle writes are still attempted

      Examples:
        | failure                                  |
        | fails on its first write                 |
        | succeeds once and fails on its next write |

    Scenario: The reviewer allowlist excludes the wrapper-only signal
      Given a managed JSON review carries the private signal
      When the public CLI constructs a reviewer environment
      Then the reviewer environment does not contain the private signal

  @reliable-observable-quality-reviews.SWM1.R2 @surface.safeword-cli @surface.claude-code @surface.openai-codex
  Rule: reliable-observable-quality-reviews.SWM1.R2 — Required-review workflows use a compatible managed wrapper

    Scenario: The wrapper scopes progress to its JSON review child
      Given the wrapper inherits a hostile private-signal value
      When it probes candidates and launches a JSON review
      Then probes receive no private signal
      And the selected JSON review child receives the exact private signal
      And progress reaches stderr before the child exits
      And the child's stdout and exit status are preserved

    Scenario Outline: The wrapper remains compatible with an older review-capable CLI
      Given an older CLI rejects unknown arguments and ignores unknown environment variables
      When the wrapper launches a JSON review returning <classification>
      Then no new argument is passed
      And the CLI result and status <status> are preserved

      Examples:
        | classification  | status |
        | approved        | 0      |
        | action-required | 2      |

    Scenario: Required-review surfaces cannot bypass the managed wrapper
      Given generated Claude Code, OpenAI Codex, and Cursor surfaces
      When independent-review launch commands are inspected
      Then required Claude Code and OpenAI Codex workflows invoke the wrapper with JSON output
      And no required workflow invokes a reviewer directly
      And Cursor contains no independent-review launch command
