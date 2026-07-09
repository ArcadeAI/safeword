# BDD source for CDX602 (Codex retro parity — invisible local extraction and
# Lane-2 filing). Proven by the vitest suite: hook-level tests spawn the real
# Codex Stop adapter while mocking only the child `codex exec` process boundary,
# and schema/config tests prove generated hook wiring. `@manual` excludes it from
# the cucumber lane while keeping it readable by codify / review-spec / safeword check.
@codex-retro-parity @manual
Feature: Codex retro parity — invisible local extraction and Lane-2 filing

  Local Codex uses the same invisible retro shape as Claude: Stop runs extraction
  out-of-band in a child Codex session, emits nothing to the conversation, routes
  findings through the shared egress/spool/direct-file path, and uses
  UserPromptSubmit additionalContext for any fallback filing nudge.

  Rule: Stop extraction is synchronous and invisible

    @codex-retro-parity.TB1.AC1 @surface.codex-stop @surface.retro-pipeline
    Scenario: The Codex Stop hook runs child extraction with an inline digest
      Given a local Codex Stop payload whose transcript_path is readable
      When the Codex Stop hook runs
      Then it spawns child `codex exec` with the transcript digest inline
      And the child environment includes `SAFEWORD_RETRO_CHILD=1`
      And the child stdin is closed
      And the child writes schema-valid JSON to the output file
      And the Stop hook waits for the child before returning
      And the Stop hook writes no conversation-visible output

    @codex-retro-parity.TB1.AC2 @surface.codex-stop
    Scenario Outline: The Codex Stop hook fails open without a continuation
      Given the Codex Stop hook encounters <failure>
      When the Codex Stop hook runs
      Then it exits zero
      And it writes no `{decision:"block"}` continuation
      And it writes no other conversation-visible output
      And no retro delta state, draft spool entry, or filed retro record is created for that session

      Examples:
        | failure                         |
        | stdin that is not valid JSON    |
        | no transcript_path              |
        | an unreadable transcript_path   |
        | a child process non-zero exit   |
        | a child process timeout         |
        | an empty child output file      |
        | a schema-invalid child output   |

    @codex-retro-parity.TB1.AC2 @surface.codex-stop
    Scenario: A retro child Stop does not spawn another extraction
      Given the environment has `SAFEWORD_RETRO_CHILD=1`
      When the Codex Stop hook runs
      Then it does not spawn child extraction
      And it exits zero
      And it writes no conversation-visible output
      And no retro delta state, draft spool entry, or filed retro record is created for that session

  Rule: Codex and Claude resolve different retro model defaults

    @codex-retro-parity.SM1.AC1 @surface.retro-model
    Scenario: Codex and Claude resolve their agent-specific defaults
      Given no retro model override exists in `.safeword/config.json`
      When each agent resolves its retro extraction model
      Then Claude resolves `sonnet`
      And Codex resolves `gpt-5.5`

    @codex-retro-parity.SM1.AC1 @surface.retro-model
    Scenario: A configured retro model overrides both agent defaults
      Given `.safeword/config.json` configures `retro.model`
      When each agent resolves its retro extraction model
      Then each agent resolves the configured `retro.model` instead of its default

  Rule: Codex uses the shared egress, spool, and filing path

    @codex-retro-parity.SM1.AC2 @surface.codex-stop @surface.retro-pipeline
    Scenario: Codex child findings are spooled and filed through the existing retro pipeline
      Given child Codex extraction returns a valid safeword finding containing raw transcript text and the secret-like token "SW-LEAK-CANARY-602"
      And the local REST transport can authenticate
      When the Codex Stop hook completes the retro path
      Then the draft spool contains only post-egress sanitized fields
      And the filed issue body contains neither the raw transcript text nor "SW-LEAK-CANARY-602"
      And no conversation-visible output contains the raw finding text

    @codex-retro-parity.SM1.AC2 @codex-retro-parity.SM1.AC3 @surface.codex-stop @surface.retro-pipeline
    Scenario Outline: Unfiled Codex drafts remain spooled for the Lane-2 nudge
      Given child Codex extraction returns a valid safeword finding
      And the local REST transport <failure>
      When the Codex Stop hook completes the retro path
      Then the post-egress draft remains in the session spool
      And the Stop hook writes no conversation-visible output

      Examples:
        | failure                         |
        | cannot authenticate             |
        | returns a retryable server error|
        | times out before filing         |

    @codex-retro-parity.SM1.AC2 @surface.codex-stop @surface.retro-pipeline
    Scenario: Empty Codex child findings stay silent and create no filing work
      Given child Codex extraction returns schema-valid output with no findings
      When the Codex Stop hook completes the retro path
      Then it exits zero
      And no draft spool entry or filed retro record is created
      And no Lane-2 nudge is queued

  Rule: UserPromptSubmit surfaces unfiled Codex drafts

    @codex-retro-parity.SM1.AC3 @surface.codex-user-prompt-submit @surface.config-wiring
    Scenario: The generated Codex config wires the packaged UserPromptSubmit hook
      Given a project installed with Codex hooks
      When a new user prompt starts after retro drafts remain spooled
      Then the Codex UserPromptSubmit hook runs `safeword codex-hook user-prompt-submit`

    @codex-retro-parity.SM1.AC3 @surface.codex-user-prompt-submit
    Scenario: The Codex prompt nudge fires once per unfiled batch
      Given retro drafts remain spooled for a Codex session
      When a new user prompt starts
      Then the hook emits the existing factual `additionalContext` nudge once per unfiled batch
      And a second user prompt over the same unfiled batch emits no duplicate nudge
      And a later user prompt over a distinct newly-spooled batch emits one new nudge
