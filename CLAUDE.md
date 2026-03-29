**⚠️ ALWAYS READ FIRST:** `.safeword/SAFEWORD.md`

The SAFEWORD.md file contains core development patterns, workflows, and conventions.
Read it BEFORE working on any task in this project.

## Version Management

When bumping the CLI version, update **both** files:

1. `packages/cli/package.json` — source of truth for npm
2. `marketplace.json` → `plugins[0].version` — source of truth for Claude Code plugin

Do NOT add version to `plugin/.claude-plugin/plugin.json` — per Claude Code docs, relative-path plugins use the marketplace entry only. A pre-commit hook blocks commits where the two versions differ.

---@./AGENTS.md
