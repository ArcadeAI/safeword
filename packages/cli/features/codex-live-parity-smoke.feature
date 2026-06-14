@codex-live-parity-smoke @live @manual
Feature: Codex live parity smoke

  Safeword's Codex parity is proven in a trusted customer-like repo after the
  generator and PreToolUse spike are available.

  Rule: Trusted Codex session sees generated safeword assets

    @codex-live-parity-smoke.SM1.AC1
    Scenario: Empty customer repo installs Codex assets
      Given an empty customer-like repository
      When safeword installs Codex-facing assets for that repository
      Then the repository contains `AGENTS.md`, `.codex/config.toml`, `.agents/skills`, and the Codex PreToolUse adapter

    @codex-live-parity-smoke.SM1.AC2
    Scenario: Trusted Codex session loads safeword instructions and skills
      Given a trusted Codex CLI session in the installed repository
      When the session starts
      Then Codex can see safeword project instructions and repo-scoped skills

  Rule: Trusted Codex session enforces supported edit hooks

    @codex-live-parity-smoke.SM1.AC3
    Scenario: Trusted Codex session denies blocked edit path
      Given a trusted Codex CLI session in the installed repository
      When the session attempts a supported edit that violates the phase gate
      Then the PreToolUse hook denies the edit with the safeword gate reason

    @codex-live-parity-smoke.SM1.AC4
    Scenario: Trusted Codex session allows valid edit path
      Given a trusted Codex CLI session in the installed repository
      When the session attempts the same supported edit after prerequisites are satisfied
      Then the PreToolUse hook allows the edit
