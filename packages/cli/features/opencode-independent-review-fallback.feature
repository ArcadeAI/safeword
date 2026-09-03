@proof.vitest
Feature: OpenCode independent review fallback

  @opencode-independent-review-fallback.TBU1.R1
  Rule: opencode-independent-review-fallback.TBU1.R1 — Existing authors keep their preferred independent reviewer before OpenCode is considered

    @surface.claude-code @surface.openai-codex @surface.opencode @surface.safeword-cli
    Scenario Outline: Existing author pairings remain preferred
      Given work authored by <author> and usable <preferred> and OpenCode reviewers
      When the builder requests an independent review
      Then <preferred> completes the review, the result names <preferred> as the independent reviewer, and OpenCode is not invoked

      Examples:
        | author | preferred |
        | Claude | Codex     |
        | Codex  | Claude    |

    @surface.claude-code @surface.openai-codex @surface.opencode @surface.safeword-cli
    Scenario: A retryable preferred-reviewer failure stays on the preferred route
      Given Claude-authored work whose Codex route fails retryably with an eligible retry remaining and a usable OpenCode reviewer
      When the builder requests an independent review
      Then Codex completes the review on retry and OpenCode is not invoked

    @surface.claude-code @surface.openai-codex @surface.opencode @surface.safeword-cli
    Scenario: A terminal preferred-reviewer failure skips retries
      Given Claude-authored work whose Codex route fails terminally with retries remaining and a usable OpenCode reviewer
      When the builder requests an independent review
      Then no Codex retry is attempted and OpenCode completes the independent review

  @opencode-independent-review-fallback.TBU1.R2
  Rule: opencode-independent-review-fallback.TBU1.R2 — OpenCode becomes the next independent route before a same-author fallback

    @surface.claude-code @surface.openai-codex @surface.opencode @surface.safeword-cli
    Scenario: OpenCode independently reviews Claude-authored work after Codex cannot complete
      Given the real review command has Claude-authored work, exhausted Codex routes, remaining review budget, and a usable OpenCode reviewer
      When the builder requests an independent review through that command
      Then OpenCode completes a cross-agent review and no same-author Claude fallback is run

    @surface.claude-code @surface.openai-codex @surface.opencode @surface.safeword-cli
    Scenario: OpenCode independent evidence satisfies the required review gate
      Given the real review command has Claude-authored work, exhausted Codex routes, remaining review budget, and a usable OpenCode reviewer under the require policy
      When the builder requests an independent review through that command
      Then the command exits successfully and the result names OpenCode as the independent reviewer

    @surface.claude-code @surface.openai-codex @surface.opencode @surface.safeword-cli
    Scenario: OpenCode independently reviews Codex-authored work after Claude cannot complete
      Given Codex-authored work, exhausted Claude routes, and a usable OpenCode reviewer
      When the builder requests an independent review
      Then OpenCode completes a cross-agent review and no same-author Codex fallback is run

    @surface.claude-code @surface.openai-codex @surface.opencode @surface.safeword-cli
    Scenario: OpenCode starts when the shared deadline leaves exactly one route budget
      Given the real review command has Claude-authored work with a usable OpenCode reviewer and a configured review clock that leaves exactly the minimum route budget after Codex fails
      When the builder requests an independent review through that command
      Then OpenCode is invoked and the command exits successfully with independent OpenCode evidence

    @rejection @surface.claude-code @surface.openai-codex @surface.opencode @surface.safeword-cli
    Scenario Outline: OpenCode is not started when the shared deadline cannot fund another route
      Given the real review command has Claude-authored work under the <policy> policy with a usable OpenCode reviewer and a configured review clock that leaves less than the minimum route budget for any further route after Codex fails
      When the builder requests an independent review through that command
      Then OpenCode is not invoked and the command exits <outcome> with no independent check

      Examples:
        | policy  | outcome          |
        | prefer  | routes exhausted |
        | require | blocked          |

    @rejection @surface.claude-code @surface.openai-codex @surface.opencode @surface.safeword-cli
    Scenario Outline: OpenCode failure preserves the existing degraded policy outcome
      Given Claude-authored work with unavailable Codex and an unusable OpenCode reviewer under the <policy> policy
      When the builder requests an independent review
      Then Claude review feedback is returned to the builder with non-independent provenance and is reported as <outcome>

      Examples:
        | policy  | outcome  |
        | prefer  | degraded |
        | require | blocked  |

  @opencode-independent-review-fallback.TBU1.R3
  Rule: opencode-independent-review-fallback.TBU1.R3 — OpenCode-authored work is reviewed by another runtime and never treats OpenCode self-review as independent

    @surface.opencode @surface.claude-code @surface.openai-codex @surface.safeword-cli
    Scenario: Claude is the preferred reviewer for OpenCode-authored work
      Given the real review command has OpenCode-authored work and usable Claude and Codex reviewers
      When the builder requests an independent review through that command
      Then Claude completes the review and neither Codex nor OpenCode is invoked

    @surface.opencode @surface.claude-code @surface.openai-codex @surface.safeword-cli
    Scenario: Codex reviews OpenCode-authored work when Claude cannot complete
      Given OpenCode-authored work, exhausted Claude routes, and a usable Codex reviewer
      When the builder requests an independent review
      Then Codex completes a cross-agent review and no OpenCode self-review is recorded

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: OpenCode self-review cannot satisfy independence
      Given OpenCode-authored work with unavailable Claude and Codex reviewers under the <policy> policy
      When the builder requests an independent review
      Then the OpenCode self-review is reported as <outcome> rather than independent

      Examples:
        | policy  | outcome  |
        | prefer  | degraded |
        | require | blocked  |

  @opencode-independent-review-fallback.TBU1.R4
  Rule: opencode-independent-review-fallback.TBU1.R4 — Every OpenCode result meets the same read-only, bounded, and provenance-checked contract as other reviewers

    @surface.opencode @surface.safeword-cli
    Scenario: A complete OpenCode event stream yields verified independent evidence
      Given Claude-authored work and an OpenCode review that emits one complete closed result for its assigned dispatch
      When Safeword evaluates the reviewer output
      Then the review is recorded as independent evidence naming OpenCode as the reviewer

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: Ambiguous OpenCode output is rejected
      Given an OpenCode process that exits successfully with <output>
      When Safeword evaluates the reviewer output
      Then the review fails as invalid output and records no independent check

      Examples:
        | output                       |
        | malformed JSON events        |
        | no complete assistant result |

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: An oversized OpenCode event stream is rejected
      Given an OpenCode process that emits an event stream beyond the shared output limit
      When Safeword evaluates the reviewer output
      Then the review fails as invalid output and records no independent check

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: Invalid OpenCode provenance is rejected
      Given an otherwise valid OpenCode result with <provenance>
      When Safeword evaluates the reviewer output
      Then the review reports a provenance verification failure and records no independent check

      Examples:
        | provenance                    |
        | a missing reviewer identity   |
        | a different reviewer identity |

    @rejection @surface.claude-code @surface.openai-codex @surface.opencode @surface.safeword-cli
    Scenario: A mismatched OpenCode dispatch blocks the required command
      Given the real review command has Claude-authored work under the require policy, exhausted Codex routes, and an OpenCode result with a different dispatch identity
      When the builder requests an independent review through that command
      Then the command exits blocked with no independent check

    @surface.claude-code @surface.openai-codex @surface.opencode @surface.safeword-cli
    Scenario: A denied OpenCode tool request cannot produce partial evidence
      Given Claude-authored work, exhausted Codex routes, and a controlled OpenCode reviewer that requests a tool before emitting one complete valid result
      When the builder requests an independent review
      Then the process is invoked with tool permissions denied, the requested tool is not executed, and only the complete result is accepted as independent evidence

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Reviewed-source mutation makes OpenCode evidence stale
      Given an OpenCode review whose reviewed source changed after dispatch and before evaluation
      When Safeword evaluates the completed review
      Then no passing independent evidence is recorded and the result is stale

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Disposable-packet mutation fails OpenCode evidence
      Given an OpenCode review whose disposable packet changed after dispatch and before evaluation
      When Safeword evaluates the completed review
      Then no passing independent evidence is recorded and the result is failed

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: A timed-out OpenCode route records no evidence
      Given Claude-authored work, exhausted Codex routes, and a controlled OpenCode reviewer that remains running past an explicitly short attempt deadline
      When the builder requests an independent review
      Then the route is recorded as timed out and no OpenCode evidence is accepted

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: A failed OpenCode process records no evidence
      Given Claude-authored work, exhausted Codex routes, and an OpenCode reviewer process that exits unsuccessfully before producing a result
      When the builder requests an independent review
      Then the route is recorded as failed and no OpenCode evidence is accepted

  @opencode-independent-review-fallback.TBU1.R5
  Rule: opencode-independent-review-fallback.TBU1.R5 — Unsupported author runtimes remain unsupported

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: Unsupported authors do not gain an OpenCode route
      Given work authored by an <author> runtime and a usable OpenCode reviewer
      When the builder requests an independent review
      Then the result reports an unsupported author runtime with no reviewer route attempted and no independent check

      Examples:
        | author  |
        | Cursor  |
        | unknown |
