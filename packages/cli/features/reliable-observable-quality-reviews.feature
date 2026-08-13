Feature: Keep quality reviews observable and actionable

  Safeword-managed independent reviews should remain visibly active during long
  work without corrupting the typed result consumed by agents and automation.
  A managed JSON review is a public CLI review carrying the exact private signal;
  the installed wrapper is its supported producer.
  Executable proof: packages/cli/tests/cli-protocol/review-wiring.test.ts,
  packages/cli/tests/cli-protocol/policy.test.ts,
  packages/cli/tests/review/surface-parity.test.ts, and
  packages/cli/tests/review/environment.test.ts.
  Quoted signal values decode \n as a line break; <unset> means the variable is absent.
  Progress writes target operating-system descriptor 2 synchronously; deferred
  stream error events and stream backpressure are not part of this boundary.
  The active-review line is due 100 milliseconds after route start. A route's
  first heartbeat is due 30 seconds after route start; every later
  heartbeat is re-armed 30 seconds after its most recent emission.

  @reliable-observable-quality-reviews.TBU1.R1 @surface.safeword-cli @proof.vitest
  Rule: reliable-observable-quality-reviews.TBU1.R1 — A managed JSON review reports rate-limited lifecycle progress separately from its final typed result

    Scenario Outline: A slow managed review remains visible without changing its result
      Given a managed JSON review that remains active through a heartbeat
      And the review is observed with a deterministic clock
      When the reviewer returns verdict <verdict>
      Then stderr consists of one active-review line followed by one heartbeat line
      And stdout consists exactly of one complete parseable schema-1 result with classification <classification> followed by EOF
      And the command exits with status <status>

      Examples:
        | verdict         | classification  | status |
        | approve         | approved        | 0      |
        | request_changes | action-required | 2      |

    Scenario Outline: Completion cancels lifecycle output at exact timer boundaries
      Given a managed JSON review observed with a deterministic clock
      When completion occurs at <boundary> with <event_order>
      Then stderr consists of <expected_lines>
      And advancing the clock through two further heartbeat intervals emits no further lifecycle lines
      And stdout consists exactly of one complete parseable schema-1 result followed by EOF

      Examples:
        | boundary | event_order             | expected_lines                              |
        | 99 ms    | completion before timer | no lifecycle lines                          |
        | 100 ms   | completion before timer | no lifecycle lines                          |
        | 100 ms   | timer before completion | the active-review line                      |
        | 29.999 s | completion before timer | the active-review line                      |
        | 30 s     | completion before timer | the active-review line                      |
        | 30 s     | timer before completion | the active-review line, then the heartbeat  |

    Scenario: Heartbeats are rate-limited and suspended clocks do not replay missed intervals
      Given a managed JSON review observed with a deterministic clock
      When active reviewer work advances directly from 0 to 95 seconds and remains active through 125 seconds
      Then the active-review line followed by one coalesced heartbeat are observed at 95 seconds
      And no additional line appears before 125 seconds
      And exactly one next heartbeat appears at 125 seconds

    Scenario: Managed timing starts with each asynchronous reviewer route
      Given packet preparation remains active for 60 seconds before reviewer work starts
      And the preferred route transitions at 45 seconds after reviewer work starts
      And the fallback route remains active through its first heartbeat and completes before its second
      And the review is observed with a deterministic clock
      When the review transitions from its preferred route to a fallback route
      Then stderr consists exactly of the preferred active-review line 100 milliseconds after reviewer work starts, its heartbeat 30 seconds after reviewer work starts, the fallback active-review line 100 milliseconds after transition, and its heartbeat 30 seconds after transition
      And no preferred-route lifecycle line appears after the fallback route starts
      And stdout consists exactly of one complete parseable schema-1 result followed by EOF

    Scenario: An alternate-model retry starts fresh lifecycle timing
      Given a managed JSON review whose preferred model fails at 45 seconds
      And the same reviewer kind retries with its configured alternate model through one heartbeat
      And the review is observed with a deterministic clock
      When the alternate-model route completes before its second heartbeat
      Then stderr consists exactly of the preferred active-review line, its heartbeat, the alternate-model active-review line, and its heartbeat in that order
      And the alternate-model lines occur 100 milliseconds and 30 seconds after that route starts
      And stdout consists exactly of one complete parseable schema-1 result followed by EOF

  @reliable-observable-quality-reviews.TBU1.R2 @surface.safeword-cli @proof.vitest
  Rule: reliable-observable-quality-reviews.TBU1.R2 — Callers that do not request managed progress keep the existing silent machine contract

    Scenario Outline: Only the exact managed signal enables JSON progress
      Given a direct JSON review with managed-progress signal value <value>
      And the review remains active through one heartbeat
      And the review is observed with a deterministic clock
      When the review completes with <stderr_kind> stderr
      Then stderr consists of <expected_lines>
      And stdout consists exactly of one complete parseable typed result followed by EOF
      And the command exits with status 0

      Examples:
        | value   | stderr_kind | expected_lines                             |
        | <unset> | non-TTY     | no lifecycle lines                         |
        | <unset> | TTY         | no lifecycle lines                         |
        | "1"     | non-TTY     | the active-review line, then the heartbeat |
        | "1"     | TTY         | the active-review line, then the heartbeat |
        | ""      | non-TTY     | no lifecycle lines                         |
        | ""      | TTY         | no lifecycle lines                         |
        | " "     | non-TTY     | no lifecycle lines                         |
        | " "     | TTY         | no lifecycle lines                         |
        | "0"     | non-TTY     | no lifecycle lines                         |
        | "0"     | TTY         | no lifecycle lines                         |
        | "01"    | non-TTY     | no lifecycle lines                         |
        | "01"    | TTY         | no lifecycle lines                         |
        | " 1"    | non-TTY     | no lifecycle lines                         |
        | " 1"    | TTY         | no lifecycle lines                         |
        | "1 "    | non-TTY     | no lifecycle lines                         |
        | "1 "    | TTY         | no lifecycle lines                         |
        | "1\n"   | non-TTY     | no lifecycle lines                         |
        | "1\n"   | TTY         | no lifecycle lines                         |
        | "true"  | non-TTY     | no lifecycle lines                         |
        | "true"  | TTY         | no lifecycle lines                         |
        | "TRUE"  | non-TTY     | no lifecycle lines                         |
        | "TRUE"  | TTY         | no lifecycle lines                         |

    Scenario Outline: Quiet mode wins over managed progress
      Given a managed JSON review with quiet mode enabled
      And the review is observed with a deterministic clock
      When the reviewer returns verdict <verdict> after one heartbeat
      Then stderr is empty
      And stdout consists exactly of one complete parseable typed result followed by EOF
      And the command exits with status <status>

      Examples:
        | verdict         | status |
        | approve         | 0      |
        | request_changes | 2      |

    Scenario: Human-readable review progress remains unchanged
      Given a human-readable review with no managed-progress signal
      And the review is observed with a deterministic clock
      When the reviewer returns an approved result after one heartbeat
      Then stderr consists exactly of the packet, active-review, and heartbeat lines in that order
      And stdout contains the human-readable verdict exactly once
      And the command exits with status 0

    Scenario: The private signal does not duplicate human-readable progress
      Given a human-readable review with managed-progress signal value "1"
      And the review is observed with a deterministic clock
      When the reviewer returns an approved result after one heartbeat
      Then stderr consists exactly of the packet, active-review, and heartbeat lines in that order
      And stdout contains the human-readable verdict exactly once
      And the command exits with status 0

  @reliable-observable-quality-reviews.SWM1.R1 @surface.safeword-cli @proof.vitest
  Rule: reliable-observable-quality-reviews.SWM1.R1 — Progress is a best-effort Safeword-owned side channel that cannot alter or disclose reviewer output

    Scenario Outline: A failed progress destination cannot alter the terminal result
      Given a managed JSON review whose operating-system progress descriptor follows <failure>
      And the review remains active through an attempted active-review write and heartbeat write
      And the review is observed with a deterministic clock
      When the reviewer completes with <classification>
      Then both lifecycle writes are attempted and their failures are swallowed
      And stdout consists exactly of the canonical typed result followed by EOF
      And no fallback diagnostic is written to stdout
      And stderr contains no partial lifecycle line
      And the command exits with status <status>

      Examples:
        | failure                         | classification  | status |
        | synchronous descriptor failure | approved        | 0      |
        | synchronous descriptor failure | action-required | 2      |
        | closed descriptor              | approved        | 0      |
        | closed descriptor              | action-required | 2      |
        | first write succeeds and second fails | approved        | 0      |
        | first write succeeds and second fails | action-required | 2      |

    Scenario: Accepted reviewer data never enters lifecycle output
      Given an accepted reviewer result contains a unique summary secret
      And configured model names use disjoint unique secrets and control characters
      When a managed review succeeds
      Then stdout contains the accepted summary secret
      And stdout consists exactly of one complete parseable schema-1 approved result followed by EOF
      And serialized stdout contains no literal injected line break or ANSI escape
      And stderr contains a positive lifecycle line naming only the assigned reviewer kind
      And stderr contains no summary secret, model secret, control character, or configured model name
      And the command exits with status 0

    Scenario Outline: Rejected reviewer data never enters public output
      Given route configuration <route_configuration>
      And rejected reviewer bytes, model names, targets, and context contain disjoint unique secrets and control characters
      And the review is observed with a deterministic clock
      When a managed review <termination>
      Then stderr contains positive lifecycle lines naming only <reviewer_kinds>
      And stdout consists exactly of one complete parseable schema-1 action-required result followed by EOF
      And the rejected reviewer bytes are absent from stdout and stderr
      And stderr contains no injected secret, control character, or model name
      And serialized stdout contains no literal injected line break or ANSI escape
      And the command exits with status 2

      Examples:
        | route_configuration    | termination          | reviewer_kinds   |
        | preferred only        | returns invalid data | Claude           |
        | preferred only        | times out            | Claude           |
        | preferred and fallback | exhausts its routes  | Claude and Codex |

    Scenario: Exhausted routes identify the failed boundary and recovery
      Given a managed JSON review for target "change.ts" whose preferred route times out and fallback returns invalid output
      And the review is observed with a deterministic clock
      When the public review command completes
      Then stdout consists exactly of one complete parseable schema-1 action-required result followed by EOF
      And the result contains finding code "REVIEW_ROUTES_EXHAUSTED"
      And the result records preferred failure "timed_out"
      And recovery equals the independently authored retry fixture for target "change.ts"
      And the command exits with status 2

  @reliable-observable-quality-reviews.SWM1.R2 @surface.safeword-cli @surface.claude-code @surface.openai-codex @proof.vitest
  Rule: reliable-observable-quality-reviews.SWM1.R2 — Every generated required-review workflow delegates to the managed wrapper while remaining compatible with an older resolved CLI

    Scenario: The wrapper scopes its private signal to the Safeword CLI child
      Given the real wrapper inherits managed-progress signal value "hostile inherited value"
      And the wrapper resolves a review-capable Safeword CLI
      When it launches a JSON review
      Then the CLI child receives managed-progress signal value "1"
      And capability probes do not contain the signal
      And stdout equals the CLI fixture's typed result byte for byte
      And stderr equals the CLI fixture's lifecycle lines byte for byte
      And the wrapper exits with the CLI fixture's status 2

    Scenario: The public CLI removes the wrapper signal from reviewer processes
      Given a direct JSON review with managed-progress signal value "1"
      When the public CLI launches a reviewer process
      Then the reviewer process environment does not contain the managed-progress signal

    Scenario: Required-review workflows cannot bypass the managed wrapper
      Given the generated Claude Code, OpenAI Codex, and Cursor trees are discovered and non-empty
      When its independent-review launch commands are inspected
      Then the required-review surfaces are exactly Claude Code and OpenAI Codex
      And every required-review workflow invokes the managed wrapper with JSON output
      And no workflow invokes the public CLI or a reviewer directly
      And Cursor contains no independent-review launch command

    Scenario Outline: The wrapper remains compatible with a CLI that predates progress support
      Given a review-capable CLI that returns <classification> with status <status>, rejects unknown arguments, and ignores unknown environment variables
      When the wrapper launches a JSON review
      Then stderr contains no Safeword-authored lifecycle line
      And the CLI's typed result is preserved byte for byte
      And the wrapper exits with the CLI's status <status>

      Examples:
        | classification  | status |
        | approved        | 0      |
        | action-required | 2      |
