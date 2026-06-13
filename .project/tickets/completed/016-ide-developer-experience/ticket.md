---
id: 016
type: epic
phase: planning
status: done
created: 2026-01-10T18:38:00Z
last_modified: 2026-04-17T04:20:00Z
children: ['015', '016b', '016c']
---

# IDE and Claude Code Integration

**Goal:** Provide seamless IDE integration and Claude Code safeguards for both safeword developers and customers.

**Why:** Format-on-save and lint-on-save provide immediate feedback. Claude Code hooks and permissions prevent LLMs from bypassing quality gates.

## Scope

### IDE Settings (015, 016b)

- `.vscode/settings.json` for monorepo (015) and customer projects (016b)
- Format-on-save with auto-detected formatter (Prettier, Biome, Ruff, gofumpt)
- Lint-on-save with ESLint, Ruff, golangci-lint based on detected languages

### Claude Code Safeguards (016c)

- Wire protective hooks for config file changes (016c)

## Children

| Ticket | Title                                             | Status |
| ------ | ------------------------------------------------- | ------ |
| 015    | Format and lint on save for safeword contributors | ready  |
| 016b   | Format and lint on save for customer projects     | ready  |
| 016c   | Protect config files from accidental LLM changes  | ready  |

**Related standalone tickets:**

- 019: Allow customers to override LLM-specific checker rules (configuration architecture)
- 020: Document user-focused ticket naming conventions (process improvement)

## Audit Findings (from ticket 015)

### What's Great (Keep As-Is)

**ESLint Architecture:**

- Multi-layered enforcement: lint-staged (pre-commit) + PostToolUse hooks (LLM edits)
- All warnings escalated to errors (LLMs ignore warnings)
- Dual-config strategy: project config for humans, stricter `.safeword/eslint.config.mjs` for LLMs
- Custom LLM-specific rules: `no-incomplete-error-handling`, `no-accumulating-spread`, `no-re-export-all`
- Smart framework detection with monorepo awareness

**Cursor Integration:**

- `afterFileEdit` hook: auto-lints via shared `lint.ts`
- `stop` hook: triggers quality review via marker files
- MDC rules and slash commands

**Claude Code Integration:**

- Comprehensive hook coverage: SessionStart, UserPromptSubmit, Stop, PostToolUse
- Skills and commands in `.claude/skills/` and `.claude/commands/`

### Gaps Addressed by This Epic

| Gap                                                                   | Ticket |
| --------------------------------------------------------------------- | ------ |
| Missing `.vscode/settings.json` in monorepo                           | 015    |
| Customers don't get `.vscode/settings.json`                           | 016b   |
| Unwired hooks: `pre-tool-config-guard.ts`, `post-tool-bypass-warn.ts` | 016c   |

### Backlog (Not This Epic)

- Missing `.cursor/environment.json` template for Background Agents
- Knip false positives (22 "unlisted" bundled deps)
- Missing secrets detection
- Missing `.editorconfig`

## Work Log

---

- 2026-01-11T05:34:00Z Deleted 016a: permissions.deny has bypass limitations, approach needs redesign
- 2026-01-10T19:51:00Z Renumbered: Tickets reordered by execution priority (permissions quick win first, then IDE, then hooks)
- 2026-01-10T19:45:00Z Refactored: Removed 016d and 016e (standalone tickets), clarified scope, renamed epic
- 2026-01-10T18:38:00Z Created: Epic created from ticket 015 audit findings, split into focused subtickets

---
