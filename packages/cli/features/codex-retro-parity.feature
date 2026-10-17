# BDD source for CDX602 (Codex retro parity — invisible local extraction and
# Lane-2 filing). Vitest proves separate boundaries: adapter tests replace the
# safeword retro child, extractor tests fake codex exec, and filing tests supply
# extracted candidates. These are not one complete Stop-to-filing test.
# `@manual` excludes these scenarios from Cucumber; do not count them as executed
# acceptance coverage. Later filing-gate behavior is documented separately and
# can emit a Stop continuation when unfiled drafts need recovery.
# Legacy TB/SM criterion IDs are retained to match the closed CDX602 spec;
# current persona names are TBU/SWM. The GH628F filing gate supersedes the
# historical unconditional Stop-silence invariant, without changing extraction.
@codex-retro-parity @manual
Feature: Codex retro parity — invisible local extraction and Lane-2 filing

  Local Codex uses the same invisible extraction shape as Claude: Stop runs extraction
  in a child Codex session, keeps extraction output out of the conversation, routes
  findings through the shared egress/spool/direct-file path, and uses
  UserPromptSubmit additionalContext for any fallback filing nudge.
  When selfReport.file is enabled, retained drafts can separately trigger the
  filing gate's Stop continuation.

  Rule: Stop extraction is synchronous and invisible

    @codex-retro-parity.TB1.AC1 @surface.openai-codex @surface.safeword-cli
    Scenario: The Codex Stop hook runs child extraction with an inline digest
      Given a local Codex Stop payload whose transcript_path is readable
      And `selfReport.file` is false
      When the Codex Stop hook runs
      Then it spawns `safeword retro run --auto-extract` with the transcript path
      And the child environment includes `SAFEWORD_RETRO_CHILD=1`
      And the Stop hook waits for the child before returning
      And the Stop hook writes no conversation-visible output

    @codex-retro-parity.TB1.AC1 @surface.safeword-cli
    Scenario: The extractor invokes Codex with a bounded digest and closed stdin
      Given a readable Codex transcript for extraction
      When the Codex extractor runs
      Then it invokes `codex exec` with the transcript digest inline
      And the child stdin is closed
      And schema-valid child output is parsed as findings

    @codex-retro-parity.TB1.AC2 @surface.openai-codex
    Scenario Outline: The Codex Stop hook fails open without a continuation
      Given the Codex Stop hook encounters <failure>
      And `selfReport.file` is false
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

    @codex-retro-parity.TB1.AC2 @surface.openai-codex
    Scenario: A retro child Stop does not spawn another extraction
      Given the environment has `SAFEWORD_RETRO_CHILD=1`
      When the Codex Stop hook runs
      Then it does not spawn child extraction
      And it exits zero
      And it writes no conversation-visible output
      And no retro delta state, draft spool entry, or filed retro record is created for that session

  Rule: Codex and Claude resolve different retro model defaults

    @codex-retro-parity.SM1.AC1 @surface.safeword-cli
    Scenario: Codex and Claude resolve their agent-specific defaults
      Given no retro model override exists in `.safeword/config.json`
      When each agent prepares its retro extraction command
      Then Claude resolves `sonnet`
      And Codex resolves `gpt-6-luna`
      And Codex requests low reasoning

    @codex-retro-parity.SM1.AC1 @surface.safeword-cli
    Scenario: A configured retro model preserves its existing reasoning behavior
      Given `.safeword/config.json` configures a `retro.model` other than `gpt-6-luna`
      When each agent prepares its retro extraction command
      Then each agent resolves the configured `retro.model` instead of its default
      And Codex adds no reasoning-effort override

  Rule: Codex uses the shared egress, spool, and filing path

    @codex-retro-parity.SM1.AC2 @surface.openai-codex @surface.safeword-cli
    Scenario: Codex child findings are filed through the existing retro pipeline
      Given child Codex extraction returns one valid safeword finding containing "sk_live_TESTONLY1" and "/acme-corp/prod/secrets.ts"
      And the local REST transport can authenticate
      When the Codex Stop hook completes the retro path
      Then exactly one issue is filed
      And the filed issue body contains neither "sk_live_TESTONLY1" nor "/acme-corp/prod/secrets.ts"
      And the filed issue body contains a redaction marker
      And the successfully filed draft is removed from the session spool

    @codex-retro-parity.SM1.AC2 @surface.openai-codex @surface.safeword-cli
    Scenario Outline: Unfiled Codex drafts remain spooled for the Lane-2 nudge
      Given child Codex extraction returns a valid safeword finding
      And `selfReport.file` is false
      And the local REST transport <failure>
      When the Codex Stop hook completes the retro path
      Then the post-egress draft remains in the session spool
      And the Stop hook writes no conversation-visible output

      Examples:
        | failure                         |
        | cannot authenticate             |
        | returns a retryable server error|
        | times out before filing         |

    @codex-retro-parity.SM1.AC2 @surface.openai-codex @surface.safeword-cli
    Scenario: Failed filing retains a nonempty sanitized draft
      Given child Codex extraction returns a valid safeword finding containing "sk_live_TESTONLY1" and "/acme-corp/prod/secrets.ts"
      And the local REST transport cannot authenticate
      When the shared retro pipeline attempts filing
      Then the session spool contains at least one draft
      And the spool file contains neither "sk_live_TESTONLY1" nor "/acme-corp/prod/secrets.ts"
      And the retained draft contains a redaction marker

    @retro-filer-gate.SM1.AC1 @surface.openai-codex
    Scenario: Enabled filing dispatches recovery for retained drafts
      Given retro drafts remain spooled for a Codex session
      And `selfReport.file` is true
      When the Codex Stop hook runs
      Then it emits a block continuation naming the retro filer skill and draft spool

    @codex-retro-parity.SM1.AC2 @surface.openai-codex @surface.safeword-cli
    Scenario: Empty Codex child findings stay silent and create no filing work
      Given child Codex extraction returns schema-valid output with no findings
      When the Codex Stop hook completes the retro path
      Then it exits zero
      And no draft spool entry or filed retro record is created
      And no Lane-2 nudge is queued

  Rule: UserPromptSubmit surfaces unfiled Codex drafts

    @codex-retro-parity.SM1.AC3 @surface.openai-codex @surface.safeword-cli
    Scenario: The generated Codex config wires the packaged UserPromptSubmit hook
      Given a project installed with Codex hooks
      When a new user prompt starts after retro drafts remain spooled
      Then the Codex UserPromptSubmit hook runs `safeword hook codex user-prompt-submit`

    @codex-retro-parity.SM1.AC3 @surface.openai-codex
    Scenario: The Codex prompt nudge fires once per unfiled batch
      Given retro drafts remain spooled for a Codex session
      When a new user prompt starts
      Then the hook emits the existing factual `additionalContext` nudge once per unfiled batch

    @codex-retro-parity.SM1.AC3 @surface.openai-codex
    Scenario: The same batch does not repeat its prompt nudge
      Given a Codex session has already been nudged for its unfiled batch
      When another user prompt starts with that same batch
      Then the hook emits no duplicate nudge

    @codex-retro-parity.SM1.AC3 @surface.openai-codex
    Scenario: A new batch receives a new prompt nudge
      Given a Codex session has already been nudged for an earlier batch
      And a distinct unfiled batch is now spooled
      When a new user prompt starts
      Then the hook emits one new factual `additionalContext` nudge

    @codex-retro-parity.SM1.AC3 @surface.openai-codex
    Scenario: No drafts produce no filing nudge
      Given no retro drafts remain spooled for a Codex session
      When a new user prompt starts
      Then the hook emits no filing nudge
