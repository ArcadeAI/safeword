@codex-live-parity-smoke @live @manual
Feature: Codex live parity smoke

  Safeword's Codex parity is proven in a trusted customer-like repo with
  package-backed Codex hook commands and no repo-local Codex implementation tree.

  Rule: Trusted Codex session sees generated safeword config

    @codex-live-parity-smoke.SM1.AC1
    Scenario: Empty customer repo installs Codex assets
      Given an empty customer-like repository
      When safeword installs Codex-facing assets for that repository
      Then the repository contains `AGENTS.md` and `.codex/config.toml` with packaged Safe Word hook commands

    @codex-live-parity-smoke.SM1.AC2
    Scenario: Trusted Codex session loads safeword project instructions
      Given a trusted Codex CLI session in the installed repository
      When the session starts
      Then Codex can see safeword project instructions without repo-local Safe Word skills

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
