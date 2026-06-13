# Impl Plan: Codex Agents Config Generation

**Status:** implemented

## Approach

Add reconcile-backed Codex assets without changing the reconciliation engine.

| Scenario                                                                           | Layer       | Implementation path                                                                                                                                    |
| ---------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `codex-agents-config-generation.SM1.AC1.fresh_setup_creates_codex_assets`          | Integration | Extend setup reconcile tests to assert `AGENTS.md`, `.codex/config.toml`, and representative `.agents/skills` files exist after setup.                 |
| `codex-agents-config-generation.SM1.AC2.config_wires_supported_pretooluse_adapter` | Integration | Inspect generated `.codex/config.toml` and assert hooks are enabled and the command points at `.safeword/hooks/codex/pre-tool-quality.ts`.             |
| `codex-agents-config-generation.SM1.AC3.existing_codex_config_is_preserved`        | Integration | Extend upgrade reconcile tests with a custom `.codex/config.toml`; assert content remains unchanged while missing `.agents/skills` assets are created. |

Build order: write failing setup/upgrade tests, add the Codex config template, register `.codex`/`.agents` directories and `.agents/skills` owned files in schema, then run schema/setup/upgrade tests.

## Decisions

| Decision               | Choice                                                              | Alternatives considered                  | Rejected because                                                                                         |
| ---------------------- | ------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Codex config ownership | Managed file at `.codex/config.toml`                                | Owned file or JSON merge                 | TOML merging is not implemented, and overwriting user Codex config would be unsafe.                      |
| Skill source           | Reuse existing `packages/cli/templates/skills` for `.agents/skills` | Maintain a separate Codex skill tree     | The content should stay identical until a concrete Codex-only incompatibility appears.                   |
| Hook wiring            | Wire only the implemented PreToolUse adapter                        | Wire future prompt-submit/stop hooks now | Broken hook commands are worse than partial generation; later tickets can add adapters once implemented. |

## Arch alignment

- Honors "Schema as Single Source of Truth" by registering generated assets in `packages/cli/src/schema.ts`.
- Honors "Reconciliation Over Copy" by using managed files for user-owned Codex config.
- Honors HPP49X by wiring only implemented hard-block paths and documenting trust/coverage limits.

## Known deviations

- Full parity is not complete in this ticket: prompt-submit done/phase enforcement, plugin packaging, and managed enterprise enforcement remain separate ranked tickets.

## Assessment triggers

- Revisit `.codex/config.toml` ownership if safeword adds a TOML merge primitive.
- Revisit skill reuse if Codex skill frontmatter diverges from Claude skill frontmatter.
- Revisit hook wiring once prompt-submit and stop adapters are implemented.

## Reconciliation

- Decisions updated: 0.
- Deviations recorded: 0.
- Implementation matched the planned managed-config and shared-skill-template shape.
