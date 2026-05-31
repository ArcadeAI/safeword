---
id: 5DEJ8V
slug: codex-agents-config-generation
type: task
phase: intake
status: in_progress
epic: codex-changelog-alignment
relates_to: QM5G9M
---

# Generate AGENTS.md + config.toml hook wiring for Codex

**Goal:** Have `safeword setup` produce the Codex install: `AGENTS.md` (instruction layer) + the `[hooks]` wiring (config.toml inline or `.codex/hooks.json`).

**Why:** This is the CLI install path that makes safeword real on Codex, parallel to the `.claude/` and `.cursor/` generators.

## Notes

- `AGENTS.md` loads from project root and walks up dirs; `project_doc_fallback_filenames` / `project_doc_max_bytes` configurable. Derive from SAFEWORD.md/CLAUDE.md.
- Hooks wire via inline `[[hooks.PreToolUse]]` in `config.toml` or project-local `.codex/hooks.json`. Project config is skipped for untrusted projects (interacts with JV6D1W).
- Reuse the existing CLI generators (`packages/cli/src/schema.ts`, `reconcile.ts`, `templates/config.ts`).

## Done when

- `setup` emits a working `AGENTS.md` + hook wiring; a fresh Codex session loads context and fires the gates.

## Source

developers.openai.com/codex/config-reference, /config-advanced

## Work Log

- 2026-05-31 Created from Codex research.
