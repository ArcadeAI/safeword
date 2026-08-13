Feature: Keep quality reviews observable and actionable

  Safeword-managed independent reviews should remain visibly active during long
  work without corrupting the typed result consumed by agents and automation.
  Executable proof: packages/cli/tests/cli-protocol/review-wiring.test.ts,
  packages/cli/tests/cli-protocol/policy.test.ts,
  packages/cli/tests/review/surface-parity.test.ts, and
  packages/cli/tests/review/environment.test.ts.
  Quoted signal values decode \n as a line break; <unset> means the variable is absent.
  Progress writes target operating-system descriptor 2 synchronously; deferred
  stream error events and stream backpressure are not part of this boundary.

  @reliable-observable-quality-reviews.TBU1.R1 @surface.safeword-cli @proof.vitest
  Rule: reliable-observable-quality-reviews.TBU1.R1 — A managed JSON review reports rate-limited lifecycle progress separately from its final typed result

    Scenario Outline: A slow managed review remains visible without changing its result
      Given a managed JSON review that remains active through a heartbeat
      And the review is observed with a deterministic clock
      When the reviewer returns verdict <verdict>
      Then stderr consists of one active-review line followed by one heartbeat line
      And stdout contains exactly one schema-1 result with classification <classification>
      And the command exits with status <status>

      Examples:
        | verdict         | classification  | status |
        | approve         | approved        | 0      |
        | request_changes | action-required | 2      |

    Scenario Outline: Completion cancels lifecycle output at exact timer boundaries
      Given a managed JSON review observed with a deterministic clock
      When completion occurs at <boundary> with <event_order>
      Then stderr contains <line_count> lifecycle lines
      And advancing the clock afterwards emits no further lifecycle lines

      Examples:
        | boundary | event_order             | line_count |
        | 99 ms    | completion before timer | 0          |
        | 100 ms   | completion before timer | 0          |
        | 100 ms   | timer before completion | 1          |
        | 29.999 s | completion before timer | 1          |
        | 30 s     | completion before timer | 1          |
        | 30 s     | timer before completion | 2          |

    Scenario: Heartbeats are rate-limited and suspended clocks do not replay missed intervals
      Given a managed JSON review observed with a deterministic clock
      When active reviewer work advances directly from 0 to 95 seconds and remains active through 125 seconds
      Then the active-review line followed by one coalesced heartbeat are observed at 95 seconds
      And no additional line appears before 125 seconds
      And exactly one next heartbeat appears at 125 seconds

    Scenario: Managed timing starts with each asynchronous reviewer route
      Given packet preparation remains active for 60 seconds before reviewer work starts
      And the preferred and fallback routes each remain active through their first heartbeat
      When the review transitions from its preferred route to a fallback route
      Then stderr consists exactly of the preferred active-review line at 100 milliseconds, its heartbeat at 30 seconds, the fallback active-review line at 100 milliseconds after transition, and its heartbeat at 30 seconds after transition
      And no preferred-route lifecycle line appears after the fallback route starts
      And stdout contains exactly one schema-1 result

  @reliable-observable-quality-reviews.TBU1.R2 @surface.safeword-cli @proof.vitest
  Rule: reliable-observable-quality-reviews.TBU1.R2 — Callers that do not request managed progress keep the existing silent machine contract

    Scenario Outline: Only the exact managed signal enables JSON progress
      Given a direct JSON review with managed-progress signal value <value>
      And the review remains active through one heartbeat
      And the review is observed with a deterministic clock
      When the review completes on TTY and non-TTY stderr
      Then stderr contains <progress_lines> lifecycle lines
      And stdout contains exactly one typed result

      Examples:
        | value | progress_lines |
        | <unset> | 0              |
        | "1"   | 2              |
        | ""    | 0              |
        | " "   | 0              |
        | "0"   | 0              |
        | "01"  | 0              |
        | "1 "  | 0              |
        | "1\n" | 0              |
        | "true" | 0              |

    Scenario Outline: Quiet mode wins over managed progress
      Given a managed JSON review with quiet mode enabled
      And the review is observed with a deterministic clock
      When the reviewer returns verdict <verdict> after one heartbeat
      Then stderr is empty
      And stdout contains exactly one typed result
      And the command exits with status <status>

      Examples:
        | verdict         | status |
        | approve         | 0      |
        | request_changes | 2      |

    Scenario: Human-readable review progress remains unchanged
      Given a human-readable review with no managed-progress signal
      And the review is observed with a deterministic clock
      When the reviewer returns an approved result after one heartbeat
      Then stderr contains the existing packet, active-review, and heartbeat lines exactly once
      And stdout contains the human-readable verdict exactly once

    Scenario: The private signal does not duplicate human-readable progress
      Given a human-readable review with managed-progress signal value "1"
      And the review is observed with a deterministic clock
      When the reviewer returns an approved result after one heartbeat
      Then stderr contains the packet, active-review, and heartbeat lines exactly once
      And stdout contains the human-readable verdict exactly once

  @reliable-observable-quality-reviews.SWM1.R1 @surface.safeword-cli @proof.vitest
  Rule: reliable-observable-quality-reviews.SWM1.R1 — Progress is a best-effort Safeword-owned side channel that cannot alter or disclose reviewer output

    Scenario Outline: A failed progress destination cannot alter the terminal result
      Given a managed JSON review whose operating-system progress descriptor has <failure> before a write
      When the reviewer completes with <classification>
      Then the process remains alive
      And stdout contains the canonical typed result
      And no fallback diagnostic is written to stdout
      And the command exits with status <status>

      Examples:
        | failure                         | classification  | status |
        | synchronous descriptor failure | approved        | 0      |
        | synchronous descriptor failure | action-required | 2      |
        | closed descriptor              | approved        | 0      |
        | closed descriptor              | action-required | 2      |

    Scenario: Accepted reviewer data never enters lifecycle output
      Given an accepted reviewer result contains a unique summary secret
      And configured model names use disjoint unique secrets and control characters
      When a managed review succeeds
      Then stdout contains the accepted summary secret
      And stdout contains exactly one parseable schema-1 result
      And serialized stdout contains no literal injected line break or ANSI escape
      And stderr contains a positive lifecycle line naming only the closed reviewer kind
      And stderr contains no summary secret, model secret, control character, or configured model name

    Scenario Outline: Rejected reviewer data never enters public output
      Given route configuration <route_configuration>
      And rejected reviewer bytes, model names, targets, and context contain disjoint unique secrets and control characters
      When a managed review <termination>
      Then stderr contains positive lifecycle lines naming only <reviewer_kinds>
      And the rejected reviewer bytes are absent from stdout and stderr
      And stderr contains no injected secret, control character, or model name
      And serialized stdout contains no literal injected line break or ANSI escape

      Examples:
        | route_configuration    | termination          | reviewer_kinds   |
        | preferred only        | returns invalid data | Claude           |
        | preferred only        | times out            | Claude           |
        | preferred and fallback | exhausts its routes  | Claude and Codex |

    Scenario: Exhausted routes identify the failed boundary and recovery
      Given a managed JSON review for target "change.ts" whose preferred route times out and fallback returns invalid output
      When the public review command completes
      Then stdout contains exactly one schema-1 action-required result
      And the result contains finding code "REVIEW_ROUTES_EXHAUSTED"
      And the result records preferred failure "timed_out"
      And recovery equals the canonical independent-review retry fixture for target "change.ts"
      And the command exits with status 2

  @reliable-observable-quality-reviews.SWM1.R2 @surface.safeword-cli @surface.claude-code @surface.openai-codex @proof.vitest
  Rule: reliable-observable-quality-reviews.SWM1.R2 — Every generated required-review workflow delegates to the managed wrapper while remaining compatible with an older resolved CLI

    Scenario: The wrapper scopes its private signal to the Safeword CLI child
      Given the real wrapper inherits managed-progress signal value "hostile inherited value"
      And the wrapper resolves a review-capable Safeword CLI
      When it launches a JSON review
      Then the CLI child receives managed-progress signal value "1"
      And capability probes do not contain the signal
      And a lifecycle line is observable on stderr before the final stdout result
      And stdout, stderr, and exit status are preserved without reinterpretation

    Scenario: The public CLI removes the wrapper signal from reviewer processes
      Given a direct JSON review with managed-progress signal value "1"
      When the public CLI launches a reviewer process
      Then the reviewer process environment does not contain the managed-progress signal

    Scenario: Required-review workflows cannot bypass the managed wrapper
      Given the complete generated Claude Code and OpenAI Codex workflow catalogue
      When its independent-review launch commands are inspected
      Then the catalogue is discovered from generated output and is non-empty
      And its size matches the generator's declared required-review surfaces
      And every workflow invokes the managed wrapper with JSON output
      And no workflow invokes the public CLI or a reviewer directly
      And Cursor contains no independent-review launch command

    Scenario: The wrapper remains compatible with a CLI that predates progress support
      Given a review-capable CLI that rejects unknown arguments but ignores unknown environment variables
      When the wrapper launches a JSON review
      Then stderr contains no Safeword-authored lifecycle line
      And the CLI's typed result is preserved byte for byte
      And the wrapper exits with the CLI's status 2
