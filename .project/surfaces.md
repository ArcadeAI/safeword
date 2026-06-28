# Surfaces

<!--
Safeword dogfoods feature surfaces here. Customer projects receive a starter
surfaces.md from packages/cli/templates/surfaces-template.md and then own it.
-->

## Claude Code

**Kind:** Agent runtime
**Audience:** Technical Builder (TB), Non-Technical Builder (NTB), Safeword Maintainer (SM)
**Examples:** `.claude/skills`, `.claude/settings.json`, slash commands, Claude hooks
**Coverage notes:** Tag feature scenarios with `@surface.claude-code` when behavior must work through Claude Code's installed files or workflow.

## Codex

**Kind:** Agent runtime
**Audience:** Technical Builder (TB), Non-Technical Builder (NTB), Safeword Maintainer (SM)
**Examples:** `.agents/skills`, `AGENTS.md`, Codex instructions, Codex hook adapter
**Coverage notes:** Tag feature scenarios with `@surface.codex` when behavior must work through Codex's installed files or workflow.

## Cursor

**Kind:** Agent runtime
**Audience:** Technical Builder (TB), Non-Technical Builder (NTB), Safeword Maintainer (SM)
**Examples:** `.cursor/rules`, `.cursor/commands`, `.cursor/hooks.json`
**Coverage notes:** Tag feature scenarios with `@surface.cursor` when behavior must work through Cursor's installed files or workflow.
