# Spec: Codex Agents Config Generation

**Feature:** Generate the first project-local Codex assets from `safeword setup` and `safeword upgrade`.

## Jobs To Be Done

### codex-agents-config-generation.SM1 - Install safeword for Codex users

**Persona:** Safeword Maintainer (SM)

> When I add Codex as a supported agent surface, I want setup and upgrade to generate Codex-readable instructions, hook wiring, and skills, so Codex users get the same safeword workflow without hand-copying Claude assets.

#### codex-agents-config-generation.SM1.AC1 - Fresh setup creates Codex-readable assets

Setup creates project-local Codex config and `.agents/skills` assets alongside the existing `AGENTS.md` safeword import.

#### codex-agents-config-generation.SM1.AC2 - Codex hook wiring points at shipped safeword hooks

The generated Codex config enables hooks and wires supported edit/shell calls to the shipped Codex PreToolUse adapter.

#### codex-agents-config-generation.SM1.AC3 - Existing user Codex config is not clobbered

Upgrade creates missing Codex directories and skills, but it does not overwrite an existing `.codex/config.toml`.

## Scope

- Generate `.codex/config.toml` as a managed file.
- Generate `.agents/skills` from the existing safeword skill templates.
- Reuse the existing `AGENTS.md` text patch as Codex's project instructions entry point.
- Wire only implemented Codex hook adapters in this slice.

## Out Of Scope

- Full prompt-submit done/phase gate implementation.
- Plugin packaging.
- Enterprise managed `requirements.toml`.
- A live trusted Codex session smoke test.

## Done When

- Setup tests prove Codex config and `.agents/skills` are created.
- Config tests prove the generated hook points at `.safeword/hooks/codex/pre-tool-quality.ts`.
- Upgrade tests prove existing `.codex/config.toml` content is preserved.
- The ticket records that trust activation remains a user/setup UX requirement.
