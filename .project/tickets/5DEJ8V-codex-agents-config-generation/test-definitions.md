# Test Definitions: Codex Agents Config Generation

Feature source: `packages/cli/features/codex-agents-config-generation.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Setup installs Codex project assets

### Scenario: codex-agents-config-generation.SM1.AC1.fresh_setup_creates_codex_assets

- [x] RED skip: uncommitted reconcile run failed before Codex assets were generated
- [x] GREEN skip: uncommitted reconcile run passed after schema/template generation
- [x] REFACTOR skip: no scenario-specific refactor needed beyond shared schema entries

### Scenario: codex-agents-config-generation.SM1.AC2.config_wires_supported_pretooluse_adapter

- [x] RED skip: uncommitted reconcile run failed before `.codex/config.toml` existed
- [x] GREEN skip: uncommitted reconcile run passed with PreToolUse wired to the Codex adapter
- [x] REFACTOR skip: no scenario-specific refactor needed beyond shared schema entries

## Rule: Upgrade preserves user-owned Codex config

### Scenario: codex-agents-config-generation.SM1.AC3.existing_codex_config_is_preserved

- [x] RED skip: uncommitted reconcile run failed before `.agents/skills` were generated
- [x] GREEN skip: uncommitted reconcile run passed while preserving existing `.codex/config.toml`
- [x] REFACTOR skip: no scenario-specific refactor needed beyond shared schema entries

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: shared schema constants cover all Codex skill path generation; no further cross-scenario refactor warranted
