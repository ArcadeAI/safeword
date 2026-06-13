# Test Definitions: Codex Agents Config Generation

## Rule: Setup installs Codex project assets

### Scenario: codex-agents-config-generation.SM1.AC1.fresh_setup_creates_codex_assets

Given a project has no Codex-specific safeword assets
When safeword setup reconciles the project
Then the project has `AGENTS.md`, `.codex/config.toml`, and `.agents/skills` safeword skill files

- [x] RED skip: uncommitted reconcile run failed before Codex assets were generated
- [x] GREEN skip: uncommitted reconcile run passed after schema/template generation
- [x] REFACTOR skip: no scenario-specific refactor needed beyond shared schema entries

### Scenario: codex-agents-config-generation.SM1.AC2.config_wires_supported_pretooluse_adapter

Given safeword setup generated project-local Codex config
When the config is inspected
Then hooks are enabled and supported edit/shell calls point at `.safeword/hooks/codex/pre-tool-quality.ts`

- [x] RED skip: uncommitted reconcile run failed before `.codex/config.toml` existed
- [x] GREEN skip: uncommitted reconcile run passed with PreToolUse wired to the Codex adapter
- [x] REFACTOR skip: no scenario-specific refactor needed beyond shared schema entries

## Rule: Upgrade preserves user-owned Codex config

### Scenario: codex-agents-config-generation.SM1.AC3.existing_codex_config_is_preserved

Given a configured project already has a custom `.codex/config.toml`
When safeword upgrade reconciles the project
Then the existing Codex config content is preserved while missing `.agents/skills` assets are created

- [x] RED skip: uncommitted reconcile run failed before `.agents/skills` were generated
- [x] GREEN skip: uncommitted reconcile run passed while preserving existing `.codex/config.toml`
- [x] REFACTOR skip: no scenario-specific refactor needed beyond shared schema entries

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: shared schema constants cover all Codex skill path generation; no further cross-scenario refactor warranted
