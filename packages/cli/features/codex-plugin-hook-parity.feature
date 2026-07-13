@codex-plugin-hook-parity
Feature: Codex plugin hook parity

  Codex plugin delivery should remove Safe Word implementation files from the
  customer's repo without weakening the behavior previously supplied by the
  repo-local Codex hook adapters.

  Rule: PreToolUse preserves quality gates and proof bridges

    @codex-plugin-hook-parity.TB1.R1 @surface.openai-codex @surface.safe-word-packaged-cli
    Scenario: Packaged PreToolUse denies the same blocked edit as the legacy adapter
      Given a Codex project with an incomplete feature ticket
      When the packaged Codex PreToolUse command receives an apply_patch that creates that ticket's test definitions
      Then it denies the edit with the Safe Word intake gate reason
      And the denial explains the Codex `$explain` escape hatch

    @codex-plugin-hook-parity.TB1.R1 @surface.openai-codex @surface.safe-word-packaged-cli
    Scenario: Packaged PreToolUse records skill and review-stamp run identity
      Given a Codex session id and project namespace root
      When the packaged Codex PreToolUse command sees Safe Word proof commands
      Then it writes the Codex run identity bridge files expected by the proof helpers

    @codex-plugin-hook-parity.TB1.R1 @surface.openai-codex @surface.safe-word-packaged-cli
    Scenario: Packaged PreToolUse preserves the shared shell safety gate
      Given a Codex project with a dangerous broad process-kill command
      When the packaged Codex PreToolUse command receives that shell command
      Then it denies the command with the shared process-kill gate reason

  Rule: PostToolUse preserves quality state and language-skill nudges

    @codex-plugin-hook-parity.TB1.R2 @surface.openai-codex @surface.safe-word-packaged-cli
    Scenario: Packaged PostToolUse accumulates quality state through the shared hook
      Given a Codex project with an active implementation ticket
      When the packaged Codex PostToolUse command receives an apply_patch edit
      Then the shared quality state records the Codex edit under that session

    @codex-plugin-hook-parity.TB1.R2 @surface.openai-codex @surface.safe-word-packaged-cli
    Scenario: Packaged PostToolUse forwards language skill nudges
      Given a Codex edit that creates source code needing a language skill nudge
      When the packaged Codex PostToolUse command runs
      Then it emits Codex PostToolUse additionalContext from the shared skill nudge hook

    @codex-plugin-hook-parity.TB1.R2 @surface.openai-codex @surface.safe-word-packaged-cli
    Scenario: Packaged PostToolUse stays quiet for edits without a language nudge
      Given a Codex edit that changes only markdown
      When the packaged Codex PostToolUse command runs
      Then it emits no language skill nudge additionalContext

  Rule: Stop preserves continuations retro work and fail-open behavior

    @codex-plugin-hook-parity.TB1.R3 @surface.openai-codex @surface.safe-word-packaged-cli
    Scenario: Packaged Stop emits architecture continuation before filing continuation
      Given a Codex done-phase session with an architecture documentation nudge
      And retro drafts are also waiting to be filed
      When the packaged Codex Stop command runs
      Then it blocks with the architecture continuation
      And it does not emit a second continuation

    @codex-plugin-hook-parity.TB1.R3 @surface.openai-codex @surface.safe-word-packaged-cli
    Scenario: Packaged Stop runs retro extraction invisibly
      Given a substantial Codex Stop payload with a readable transcript
      When the packaged Codex Stop command runs
      Then it launches the Codex retro extraction path
      And it returns no conversation-visible output unless filing is required

    @codex-plugin-hook-parity.TB1.R3 @surface.openai-codex @surface.safe-word-packaged-cli
    Scenario: Packaged Stop fails open with valid JSON
      Given malformed Codex Stop input
      When the packaged Codex Stop command runs
      Then it exits successfully with the no-continuation JSON object

  Rule: SessionStart preserves context and auto-upgrade behavior through one dispatcher

    @codex-plugin-hook-parity.TB1.R4 @surface.openai-codex @surface.safe-word-packaged-cli
    Scenario: Packaged SessionStart runs auto-upgrade before emitting SAFEWORD context
      Given a Codex project with no applicable Safe Word upgrade
      When the packaged Codex SessionStart command runs
      Then it invokes the shared auto-upgrade core
      And it emits SessionStart additionalContext containing SAFEWORD.md

    @codex-plugin-hook-parity.TB1.R4 @surface.openai-codex @surface.safe-word-packaged-cli
    Scenario: Packaged SessionStart includes upgrade notices without exit-code blocking
      Given the shared auto-upgrade core reports a visible notice
      When the packaged Codex SessionStart command runs
      Then the notice is included in SessionStart additionalContext
      And the command exits successfully

  Rule: UserPromptSubmit preserves queued prompt context

    @codex-plugin-hook-parity.TB1.R5 @surface.openai-codex @surface.safe-word-packaged-cli
    Scenario: Packaged UserPromptSubmit emits queued Safe Word prompt context
      Given queued Safe Word prompt context for a Codex project
      When the packaged Codex UserPromptSubmit command runs
      Then it emits Codex UserPromptSubmit additionalContext containing that queued context
      And the queued context remains project-owned data, not plugin implementation

    @codex-plugin-hook-parity.TB1.R5 @surface.openai-codex @surface.safe-word-packaged-cli
    Scenario: Packaged UserPromptSubmit stays quiet with no queued prompt context
      Given no queued Safe Word prompt context for a Codex project
      When the packaged Codex UserPromptSubmit command runs
      Then it exits successfully with no additionalContext

  Rule: Parity evidence is layered before live smoke

    @codex-plugin-hook-parity.SM1.R1 @surface.openai-codex @surface.codex-plugin-hooks @surface.safe-word-packaged-cli
    Scenario: Event-by-event parity map covers every legacy adapter behavior
      Given the legacy Codex adapters and packaged hook command are inspected
      When the parity audit is generated
      Then every behavior is marked preserve redesign or defer with a rationale
      And every preserved behavior names a deterministic proof
      And every deferred behavior names the follow-up or explicit non-goal

    @codex-plugin-hook-parity.SM1.R2 @surface.codex-plugin-hooks @surface.safe-word-packaged-cli
    Scenario: Plugin manifest commands all use the packaged hook command
      Given the Codex plugin hook manifest
      When hook commands are inspected
      Then every Safe Word hook command runs `safeword hook codex`
      And no command points at repo-local `.safeword/hooks/codex`

    @codex-plugin-hook-parity.SM1.R2 @surface.safe-word-packaged-cli
    Scenario: Hidden compatibility alias preserves the packaged hook contract
      Given a legacy Safe Word Codex hook command invokes `safeword codex-hook pre-tool-use`
      When it receives the same blocked edit payload as `safeword hook codex pre-tool-use`
      Then both commands deny with the same Codex hook JSON contract

    @codex-plugin-hook-parity.SM1.R3 @live @manual @surface.openai-codex
    Scenario: Live vetted plugin run observes package-backed lifecycle dispatch
      Given an isolated CODEX_HOME with the Safe Word plugin installed
      And the live smoke uses Codex's explicit one-off hook-trust bypass
      When real `codex exec --json` starts a no-tool session
      Then the plugin SessionStart hook invokes the packaged `safeword hook codex session-start` command
      And the customer repo contains no repo-local Safe Word Codex implementation tree
