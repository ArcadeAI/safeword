Feature: Keep quality reviews observable and actionable

  Safeword-managed independent reviews should remain visibly active during long
  work without corrupting the typed result consumed by agents and automation.
  Unless a scenario says otherwise, JSON review stderr is observed through a
  non-TTY pipe.
  A managed JSON review is launched by Safeword's wrapper; a direct JSON review
  invokes the public command without that wrapper. Quoted expected-lines values
  decode \n as a line break and omit the final line terminator.
  Executable proof: packages/cli/tests/cli-protocol/review-wiring.test.ts,
  packages/cli/tests/cli-protocol/policy.test.ts,
  packages/cli/tests/review/surface-parity.test.ts, and
  packages/cli/tests/review/environment.test.ts.

  @reliable-observable-quality-reviews.TBU1.R1 @surface.safeword-cli @proof.vitest
  Rule: reliable-observable-quality-reviews.TBU1.R1 — A managed JSON review reports rate-limited lifecycle progress separately from its final typed result

    The first heartbeat is due one interval after route start. Later heartbeats
    are re-armed from the most recent heartbeat emission; missed intervals
    coalesce rather than replay after a suspended clock.

    Scenario: A wrapper-launched slow review remains visibly active until approval
      Given a managed JSON review whose Claude reviewer returns verdict "approve" after one heartbeat
      And the review is observed with a deterministic clock
      When the public review command completes
      Then stdout consists of exactly one schema-1 approved result with reviewer verdict "approve" and no other bytes
      And stderr consists of one "Requesting an independent Claude review…" line followed by one "Still waiting for a response from Claude…" line
      And the command exits with status 0

    Scenario: The exact managed-progress signal enables JSON progress
      Given a direct JSON review with managed-progress signal value "1"
      And a Claude reviewer that returns verdict "approve" after one heartbeat
      And the review is observed with a deterministic clock
      When the public review command completes
      Then stdout consists of exactly one schema-1 approved result with reviewer verdict "approve" and no other bytes
      And stderr consists of one "Requesting an independent Claude review…" line followed by one "Still waiting for a response from Claude…" line
      And the command exits with status 0

    Scenario Outline: Completion cancels the delayed active line at its boundary
      Given a managed JSON review observed with a deterministic clock
      And the delayed active-review line is due at 100 ms
      When the review completes at <completion> with event order <order>
      Then stderr before completion equals <expected_lines>
      And advancing the clock afterwards emits no further lifecycle lines

      Examples:
        | completion | order                   | expected_lines                              |
        | 99 ms      | completion before timer | ""                                          |
        | 100 ms     | completion before timer | ""                                          |
        | 100 ms     | timer before completion | "Requesting an independent Claude review…" |

    Scenario Outline: Completion cancels the first heartbeat at its boundary
      Given a managed JSON review observed with a deterministic clock
      And its route started at 0 seconds
      And its active-review line was emitted at 100 milliseconds
      And its first heartbeat is due at 30 seconds
      When the review completes at <completion> with event order <order>
      Then stderr before completion equals <expected_lines>
      And advancing the clock afterwards emits no further lifecycle lines

      Examples:
        | completion | order                   | expected_lines                                                                         |
        | 29.999 s   | completion before timer | "Requesting an independent Claude review…"                                            |
        | 30 s       | completion before timer | "Requesting an independent Claude review…"                                            |
        | 30 s       | timer before completion | "Requesting an independent Claude review…\nStill waiting for a response from Claude…" |

    Scenario: Lifecycle progress is delayed and rate-limited
      Given a managed JSON review observed with a deterministic clock
      And packet preparation completes before reviewer-route work starts
      When the clock reaches 60 seconds while the stage is active and advances 1 millisecond before completion
      Then stderr emits no progress before 100 milliseconds
      And stderr emits "Requesting an independent Claude review…" once at 100 milliseconds
      And stderr emits one heartbeat at 30 seconds and one at 60 seconds
      And stderr emits no lifecycle write at or after completion
      And stderr consists exactly of the active-review line followed by two heartbeat lines

    @rejection
    Scenario: Managed JSON deliberately suppresses packet-preparation progress
      Given a managed JSON review observed with a deterministic clock
      When packet preparation remains active for 60 seconds before reviewer-route work starts
      Then stderr is empty throughout packet preparation
      And "Requesting an independent Claude review…" first appears at 60.100 seconds

    Scenario: A large clock advance coalesces missed heartbeats
      Given a managed JSON review observed with a deterministic clock
      When an active review advances directly from 0 to 95 seconds and remains active through 125 seconds
      Then stderr at 95 seconds consists exactly of "Requesting an independent Claude review…" followed by one "Still waiting for a response from Claude…" line
      And both due lines are observed at 95 seconds without replaying missed intervals
      And no further line appears before 125 seconds
      And one next heartbeat appears at 125 seconds
      And stderr then consists exactly of the active-review line followed by two heartbeat lines
      And completing then emits no further lifecycle line

    @rejection
    Scenario: An action-required result follows progress without losing its classification
      Given a managed JSON review whose Claude reviewer returns verdict "request_changes" with error finding "Unsafe retry" after one heartbeat
      And the review is observed with a deterministic clock
      When the public review command completes
      Then stdout consists of exactly one schema-1 action-required result with verdict "request_changes" and error finding "Unsafe retry" and no other bytes
      And stderr consists of one "Requesting an independent Claude review…" line followed by one "Still waiting for a response from Claude…" line
      And the command exits with status 2

    @rejection
    Scenario: Exhausted routes remain a typed result after visible transitions
      Given a managed JSON review observed with a deterministic clock
      And review target "change.ts"
      And no alternate reviewer model is configured
      And the Claude route emits reviewer secret "ZXQ-919-preferred" and times out at 31 seconds after one heartbeat
      And the attempt timeout is 31 seconds
      And the Codex fallback emits reviewer secret "ZXQ-920-fallback" and returns invalid output after one heartbeat
      When the public review command completes
      Then stderr consists exactly of "Requesting an independent Claude review…", "Still waiting for a response from Claude…", "Claude did not complete; trying a Codex fallback…", and "Still waiting for a response from the Codex fallback…" in that order
      And stdout consists of exactly one schema-1 action-required result with finding code "REVIEW_ROUTES_EXHAUSTED" and no other bytes
      And the result records preferred failure "timed_out" and fallback failure "invalid_output"
      And neither stdout nor stderr contains reviewer secret "ZXQ-919-preferred" or "ZXQ-920-fallback"
      And recovery equals the canonical independent-review retry fixture for target "change.ts"
      And the command exits with status 2

    Scenario: A fallback route receives fresh lifecycle timers
      Given a managed JSON review observed with a deterministic clock
      And no alternate reviewer model is configured
      And Claude starts at 0 seconds, heartbeats at 30 seconds, and times out at 31 seconds
      And Codex starts at 31 seconds, remains active through its 61-second heartbeat, and returns verdict "approve" at 61.001 seconds
      When the clock advances through that route sequence
      Then stderr consists exactly of the Claude active line at 0.100 seconds, Claude heartbeat at 30 seconds, Codex fallback transition at 31.100 seconds, and Codex fallback heartbeat at 61 seconds
      And stdout equals the canonical schema-1 two-route Codex-fallback approved-review fixture byte for byte
      And the result records reviewer "codex" with degraded independence
      And the result records preferred failure "timed_out" with no alternate-model failure
      And the command exits with status 0
      And advancing the clock after completion emits no further lifecycle lines

    Scenario: An alternate reviewer model receives fresh lifecycle timers before fallback
      Given a managed JSON review observed with a deterministic clock
      And Claude's default model starts at 0 seconds and fails at 31 seconds
      And Claude's configured alternate model starts at 31 seconds and fails at 62 seconds
      And the Codex fallback starts at 62 seconds and returns verdict "approve" after its first heartbeat
      When the clock advances through that three-route sequence
      Then stderr consists exactly of "Requesting an independent Claude review…" at 0.100 seconds, "Still waiting for a response from Claude…" at 30 seconds, "Trying Claude again with the configured alternate model…" at 31.100 seconds, "Still waiting for Claude on the alternate model…" at 61 seconds, "Claude did not complete; trying a Codex fallback…" at 62.100 seconds, and "Still waiting for a response from the Codex fallback…" at 92 seconds
      And stdout equals the canonical schema-1 three-route Codex-fallback approved-review fixture byte for byte
      And the result records reviewer "codex" with degraded independence
      And the result records preferred failure "timed_out" and alternate-model failure "process_failed"
      And the command exits with status 0
      And advancing the clock after completion emits no further lifecycle lines

  @reliable-observable-quality-reviews.TBU1.R2 @surface.safeword-cli @proof.vitest
  Rule: reliable-observable-quality-reviews.TBU1.R2 — Callers that do not request managed progress keep the existing silent machine contract

    @rejection
    Scenario: A direct JSON review stays silent while returning its result
      Given a direct JSON review with no managed-progress signal
      And a reviewer that returns verdict "approve" after one heartbeat
      And the review is observed with a deterministic clock
      When the public review command completes
      Then stdout consists of exactly one schema-1 approved result with reviewer verdict "approve" and no other bytes
      And stderr is empty
      And the command exits with status 0

    @rejection
    Scenario: A direct JSON review stays silent on TTY stderr
      Given a direct JSON review with no managed-progress signal
      And stderr is a TTY
      And a reviewer that returns verdict "approve" after one heartbeat
      When the public review command completes
      Then stderr is empty
      And stdout consists of exactly one schema-1 approved result

    @rejection
    Scenario Outline: Unsupported managed-progress signal values do not change JSON output
      Given a direct JSON review with managed-progress signal value <value>
      And a reviewer that returns verdict "approve" after one heartbeat
      And the review is observed with a deterministic clock
      When the public review command completes
      Then stdout consists of exactly one schema-1 approved result with reviewer verdict "approve" and no other bytes
      And stderr is empty
      And the command exits with status 0

      Examples:
        | value   |
        | ""      |
        | " "     |
        | "0"     |
        | "01"    |
        | "1 "    |
        | "TRUE"  |
        | "true"  |
        | "false" |

    @rejection
    Scenario: Quiet mode suppresses progress even for a managed review
      Given a managed JSON review with quiet mode enabled
      And a reviewer that returns verdict "approve" after one heartbeat
      And the review is observed with a deterministic clock
      When the public review command completes
      Then stdout consists of exactly one schema-1 approved result with reviewer verdict "approve" and no other bytes
      And stderr is empty
      And the command exits with status 0

    @rejection
    Scenario: Quiet mode suppresses progress for a human-readable review
      Given a managed human-readable review with quiet mode enabled
      And a reviewer that returns verdict "approve" after one heartbeat
      And the review is observed with a deterministic clock
      When the public review command completes
      Then stdout and stderr are empty
      And the reviewer fixture records exactly one launch
      And the command exits with status 0

    @rejection
    Scenario: Quiet human-readable action-required output is conveyed by status
      Given a managed human-readable review with quiet mode enabled
      And a reviewer that returns verdict "request_changes" with error finding "Unsafe retry"
      When the public review command completes
      Then stdout and stderr are empty
      And the command exits with status 2
      And the reviewer fixture records exactly one request_changes verdict with error finding "Unsafe retry"

    Scenario: Human output does not duplicate lifecycle progress
      Given a managed human-readable review whose Claude reviewer returns verdict "approve" after one heartbeat
      And stderr is a non-TTY pipe
      And the review is observed with a deterministic clock
      When the public review command completes
      Then "Preparing the review packet for Claude…" appears exactly once on stderr
      And "Requesting an independent Claude review…" appears exactly once on stderr
      And "Still waiting for a response from Claude…" appears exactly once on stderr
      And stdout consists of the human-readable approved verdict exactly once
      And stdout contains no lifecycle progress
      And stderr contains no verdict or result output

    Scenario: Ordinary piped human output retains progress
      Given a human-readable review with no managed-progress signal
      And stderr is a non-TTY pipe
      And a Claude reviewer that returns verdict "approve" after one heartbeat
      And the review is observed with a deterministic clock
      When the public review command completes
      Then "Requesting an independent Claude review…" appears exactly once on stderr
      And "Still waiting for a response from Claude…" appears exactly once on stderr
      And stdout consists of the human-readable approved verdict exactly once

    Scenario: Managed JSON progress is identical on TTY stderr
      Given a managed JSON review whose Claude reviewer returns verdict "approve" after one heartbeat
      And stderr is a TTY
      And the review is observed with a deterministic clock
      When the public review command completes
      Then stderr consists of one "Requesting an independent Claude review…" line followed by one "Still waiting for a response from Claude…" line
      And stdout consists of exactly one schema-1 approved result

  @reliable-observable-quality-reviews.SWM1.R1 @surface.safeword-cli @proof.vitest
  Rule: reliable-observable-quality-reviews.SWM1.R1 — Progress is a best-effort Safeword-owned side channel that cannot alter or disclose reviewer output

    Scenario: Successful reviewer stderr never becomes public output
      Given a managed JSON review whose Claude reviewer writes secret "ZXQ-916-approved" to its own stderr and returns verdict "approve" after one heartbeat
      And the review is observed with a deterministic clock
      When the public review command completes
      Then stdout equals the canonical schema-1 approved-review fixture byte for byte
      And stderr consists exactly of "Requesting an independent Claude review…" followed by "Still waiting for a response from Claude…"
      And neither stdout nor stderr contains "ZXQ-916-approved"
      And the command exits with status 0

    @rejection
    Scenario Outline: Progress write failures do not change terminal review results
      Given a managed JSON review whose progress destination fails by <failure_mode>
      And a slow reviewer using canonical fixture <fixture> after one heartbeat
      And the review is observed with a deterministic clock
      When the public review command completes
      Then two lifecycle writes are attempted without a fallback diagnostic
      And stdout equals canonical result fixture <fixture> byte for byte
      And public stderr remains empty
      And the CLI process remains alive through the final result
      And the command exits with status <status>

      Examples:
        | failure_mode                    | fixture                | status |
        | synchronous descriptor failure | "approved-review"      | 0      |
        | closed descriptor               | "approved-review"      | 0      |
        | synchronous descriptor failure | "unsafe-retry-finding" | 2      |
        | closed descriptor               | "unsafe-retry-finding" | 2      |

    @rejection
    Scenario: Rejected reviewer bytes never become progress output
      Given a managed JSON review whose reviewer emits unique secret "ZXQ-917-secret" outside the result contract
      And no alternate reviewer model is configured
      And the remaining reviewer-work budget cannot fund a fallback route
      And the review is observed with a deterministic clock and completes at 101 milliseconds
      When the public review command completes
      Then stdout equals the canonical schema-1 invalid-reviewer-output envelope byte for byte
      And the result records preferred failure "invalid_output"
      And stderr consists of one "Requesting an independent Claude review…" line
      And neither stdout nor stderr contains "ZXQ-917-secret"
      And the command exits with status 2

    @rejection
    Scenario: Timed-out reviewer bytes never become public output
      Given a managed JSON review whose reviewer emits unique secret "ZXQ-918-timeout" and then never exits
      And no alternate reviewer model is configured
      And the remaining reviewer-work budget cannot fund a fallback route
      And the review is observed with a deterministic clock and a 60.001-second attempt timeout
      When the public review command completes
      Then stdout equals the canonical schema-1 timed-out envelope byte for byte
      And stderr consists exactly of "Requesting an independent Claude review…" followed by two "Still waiting for a response from Claude…" lines
      And neither stdout nor stderr contains "ZXQ-918-timeout"
      And the command exits with status 2

    @rejection
    Scenario: Configured model text never enters lifecycle progress
      Given a managed JSON review with alternate model name "model\n\u001b[31mZXQ-921"
      And review target "change\n\u001b[31mZXQ-922.ts" with context "evidence\n\u001b[31mZXQ-923.md"
      And the default Claude route fails before the alternate route starts
      And the alternate Claude route fails and the Codex fallback returns verdict "approve"
      When the public review command completes
      Then stderr contains the fixed line "Trying Claude again with the configured alternate model…"
      And neither stdout nor stderr contains "ZXQ-921", "ZXQ-922", "ZXQ-923", or an ANSI escape
      And stdout consists of exactly one schema-1 approved result from reviewer "codex"
      And the command exits with status 0

    @rejection
    Scenario: Hostile target text is safely encoded in exhausted-route recovery
      Given a managed JSON review for target "change\n\u001b[31mZXQ-924.ts" whose routes all fail
      When the public review command completes
      Then the parsed recovery equals the canonical retry fixture for that target
      And serialized stdout contains no literal injected line break or ANSI escape
      And the command exits with status 2

  @reliable-observable-quality-reviews.SWM1.R2 @surface.safeword-cli @surface.claude-code @surface.openai-codex @proof.vitest
  Rule: reliable-observable-quality-reviews.SWM1.R2 — Every generated required-review workflow delegates to the managed wrapper while remaining compatible with an older resolved CLI

    Scenario: The managed wrapper forwards progress before the review finishes
      Given the real managed wrapper resolves a review-capable CLI that emits progress and remains active
      And the CLI fixture waits for the harness to acknowledge the progress line before it exits
      When the wrapper launches a JSON review
      Then the progress line is observable before the CLI exits
      And the terminal result remains absent until the CLI exits
      And the wrapper preserves the CLI result and exit status after completion

    Scenario Outline: Installed required-review workflows use the managed wrapper
      Given a temporary project with the generated <surface> required-review workflow installed
      And a wrapper fixture that emits stdout <stdout>, stderr <stderr>, and exit status <status>
      When the installed workflow launches an independent review for target "change.ts" with context "evidence.md"
      Then the real installed entry point invokes Safeword's managed review wrapper for target "change.ts" with context "evidence.md" and JSON output
      And it does not launch the public CLI or a reviewer directly
      And the installed workflow emits stdout <stdout> and stderr <stderr> byte for byte
      And the installed workflow exits with status <status>

      Examples:
        | surface      | stdout   | stderr     | status |
        | Claude Code  | "RESULT" | "PROGRESS" | 2      |
        | Claude Code  | "RESULT" | "PROGRESS" | 0      |
        | Claude Code  | "RESULT" | ""         | 0      |
        | Claude Code  | ""       | "ERROR"    | 1      |
        | OpenAI Codex | "RESULT" | "PROGRESS" | 2      |
        | OpenAI Codex | "RESULT" | "PROGRESS" | 0      |
        | OpenAI Codex | "RESULT" | ""         | 0      |
        | OpenAI Codex | ""       | "ERROR"    | 127    |

    Scenario: The real wrapper scopes managed progress to its CLI child
      Given the real managed wrapper resolves a CLI fixture that records its environment and launches a reviewer fixture
      When the wrapper launches a JSON review
      Then the CLI fixture observes managed-progress signal value "1"
      And the reviewer fixture records exactly one launch and its environment
      And that recorded reviewer environment does not contain the managed-progress signal

    Scenario: The real public command removes managed progress from the reviewer environment
      Given a direct JSON review with managed-progress signal value "1"
      And a real reviewer fixture that records its environment and returns verdict "approve"
      When the public review command completes
      Then the reviewer fixture records exactly one launch
      And its recorded environment does not contain the managed-progress signal

    @rejection
    Scenario: No generated required-review workflow bypasses the managed wrapper
      Given the complete generated required-review workflow catalogue
      When its review launch commands are inspected
      Then the catalogue is non-empty and contains the Claude Code and OpenAI Codex workflows
      And every workflow invokes the managed wrapper
      And no workflow invokes the public CLI or a reviewer directly

    @rejection
    Scenario: An older resolved CLI completes silently instead of rejecting the wrapper signal
      Given the managed wrapper resolves a review-capable CLI that predates progress support
      And that CLI ignores unknown environment variables but exits with a usage error for every unknown argument
      And that CLI returns the canonical schema-1 action-required fixture with status 2 for the supported review arguments
      When the wrapper launches a JSON review
      Then stdout equals the canonical schema-1 action-required fixture byte for byte
      And stderr is empty
      And the wrapper exits with status 2
