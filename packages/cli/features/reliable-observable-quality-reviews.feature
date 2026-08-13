Feature: Keep quality reviews observable and actionable

  Safeword-managed independent reviews should remain visibly active during long
  work without corrupting the typed result consumed by agents and automation.
  Executable proof: packages/cli/tests/cli-protocol/review-wiring.test.ts,
  packages/cli/tests/cli-protocol/policy.test.ts,
  packages/cli/tests/review/surface-parity.test.ts, and
  packages/cli/tests/review/environment.test.ts.

  @reliable-observable-quality-reviews.TBU1.R1 @surface.safeword-cli @proof.vitest
  Rule: reliable-observable-quality-reviews.TBU1.R1 — Managed JSON reviews report bounded lifecycle progress separately from their typed result

    Scenario Outline: A slow managed review remains visible without changing its result
      Given a managed JSON review that remains active through a heartbeat
      When the reviewer returns verdict <verdict>
      Then stderr contains only fixed Safeword lifecycle lines
      And stdout contains exactly one schema-1 result with classification <classification>
      And the command exits with status <status>
      And completion prevents every pending lifecycle write

      Examples:
        | verdict         | classification  | status |
        | approve         | approved        | 0      |
        | request_changes | action-required | 2      |

    Scenario: Lifecycle reporting is bounded across slow or delayed clocks
      Given a managed JSON review observed with a deterministic clock
      When asynchronous reviewer work starts and the clock advances
      Then the active line is delayed
      And heartbeats are rate-limited and missed intervals coalesce
      And packet preparation emits no managed JSON progress
      And route transitions start fresh lifecycle timers
      And completion cancels delayed lines and heartbeats at their boundary

  @reliable-observable-quality-reviews.TBU1.R2 @surface.safeword-cli @proof.vitest
  Rule: reliable-observable-quality-reviews.TBU1.R2 — Other callers retain their existing output contract

    Scenario: Only the exact managed signal enables JSON progress
      Given direct JSON reviews with no signal or unsupported signal values
      When the reviews complete on TTY and non-TTY stderr
      Then stderr remains empty and stdout contains exactly one typed result
      But signal value "1" enables the fixed lifecycle lines
      And quiet mode suppresses progress even when that signal is present
      And ordinary human-readable review progress remains unchanged

  @reliable-observable-quality-reviews.SWM1.R1 @surface.safeword-cli @proof.vitest
  Rule: reliable-observable-quality-reviews.SWM1.R1 — Progress is a best-effort Safeword-owned side channel

    Scenario Outline: A failed progress destination cannot alter the terminal result
      Given a managed JSON review whose progress destination has <failure>
      When the reviewer completes with <classification>
      Then the process remains alive
      And stdout contains the canonical typed result
      And no fallback diagnostic is written
      And the command exits with the classification's existing status

      Examples:
        | failure                        | classification  |
        | synchronous descriptor failure | approved        |
        | closed descriptor              | action-required |

    Scenario: Lifecycle output cannot disclose untrusted review data
      Given reviewer output, model names, targets, and context contain unique secrets and control characters
      When a managed review succeeds, fails, times out, or exhausts its routes
      Then stderr contains only fixed Safeword lifecycle lines
      And rejected or timed-out reviewer bytes are absent from public output
      And recovery data remains safely encoded in the typed result

  @reliable-observable-quality-reviews.SWM1.R2 @surface.safeword-cli @surface.claude-code @surface.openai-codex @proof.vitest
  Rule: reliable-observable-quality-reviews.SWM1.R2 — Generated required-review workflows use the compatible managed wrapper

    Scenario: The wrapper scopes its private signal to the Safeword CLI child
      Given the real wrapper resolves a review-capable Safeword CLI
      When it launches a JSON review
      Then the CLI child receives managed-progress signal value "1"
      And probes and reviewer processes do not receive the signal
      And stdout, stderr, and exit status are inherited without buffering or reinterpretation

    Scenario: Required-review workflows cannot bypass the managed wrapper
      Given the complete generated Claude Code and OpenAI Codex workflow catalogue
      When its independent-review launch commands are inspected
      Then every workflow invokes the managed wrapper with JSON output
      And no workflow invokes the public CLI or a reviewer directly

    Scenario: The wrapper remains compatible with a CLI that predates progress support
      Given a review-capable CLI that rejects unknown arguments but ignores unknown environment variables
      When the wrapper launches a JSON review
      Then no progress line is required
      And the CLI's typed result and exit status are preserved byte for byte
