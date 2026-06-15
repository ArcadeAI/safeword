@codex-agents-config-generation
Feature: Codex agents config generation

  Safeword setup and upgrade generate Codex-readable project assets without
  overwriting user-owned Codex configuration.

  Rule: Setup installs Codex project assets

    @codex-agents-config-generation.SM1.AC1
    Scenario: codex-agents-config-generation.SM1.AC1.fresh_setup_creates_codex_assets
      Given a project has no Codex-specific safeword assets
      When safeword setup reconciles the project
      Then the project has `.codex/config.toml` and `.agents/skills` safeword skill files

    @codex-agents-config-generation.SM1.AC2
    Scenario: codex-agents-config-generation.SM1.AC2.config_wires_supported_pretooluse_adapter
      Given safeword setup generated project-local Codex config
      When the config is inspected
      Then hooks are enabled and supported edit/shell calls point at `.safeword/hooks/codex/pre-tool-quality.ts`

    @codex-agents-config-generation.SM1.AC4
    Scenario: codex-agents-config-generation.SM1.AC4.setup_reports_codex_hook_trust_step
      Given a project has no Codex-specific safeword assets
      When safeword setup reconciles the project
      Then safeword tells the user to run `/hooks` before relying on Codex gates

  Rule: Upgrade preserves user-owned Codex config

    @codex-agents-config-generation.SM1.AC3
    Scenario: codex-agents-config-generation.SM1.AC3.existing_codex_config_is_preserved
      Given a configured project already has a custom `.codex/config.toml`
      When safeword upgrade reconciles the project
      Then the existing Codex config content is preserved while missing `.agents/skills` assets are created

    @codex-agents-config-generation.SM1.AC5
    Scenario: codex-agents-config-generation.SM1.AC5.upgrade_reports_codex_hook_trust_step
      Given a configured project has no `.codex/config.toml`
      When safeword upgrade reconciles the project
      Then safeword tells the user to run `/hooks` before relying on Codex gates
