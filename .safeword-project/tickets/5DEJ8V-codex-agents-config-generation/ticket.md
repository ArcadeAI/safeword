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

**Goal:** Have `safeword setup` produce the Codex install: `AGENTS.md` (instructions), hook wiring, and skills in `.agents/skills`.

**Why:** The CLI install path that makes safeword real on Codex, parallel to the `.claude/` and `.cursor/` generators.

## Grounded mechanics (researched 2026-05-31)

- **AGENTS.md** — loads from project root, walks up dirs; `project_doc_max_bytes` / `project_doc_fallback_filenames` configurable. Derive from SAFEWORD.md/CLAUDE.md. (Confirm nested-merge order on the AGENTS.md doc page — that exact page 404'd on first probe; resolve URL.)
- **Hook wiring** — inline `[hooks]` in `config.toml` (`~/.codex/config.toml` global, `<repo>/.codex/config.toml` project) OR `.codex/hooks.json` (global + project). All matching layers run — no override. Project config is skipped for untrusted projects (ties to trust gate, JV6D1W).
- **Skills** go in `.agents/skills/` (NOT config) — see QGHVXZ.
- **Managed/enterprise** wiring is `requirements.toml`, separate path (JV6D1W).

## Done when

- `setup` emits `AGENTS.md` + hook wiring (config.toml or .codex/hooks.json) + `.agents/skills`; a fresh Codex session loads context and fires the gates.
- Reuses existing generators (`packages/cli/src/schema.ts`, `reconcile.ts`, `templates/config.ts`).

## Source

developers.openai.com/codex/config-reference, /config-advanced, /hooks, /skills

## Work Log

- 2026-05-31 Created from Codex research.
- 2026-05-31 Grounded hook-wiring locations + skills path; flagged AGENTS.md doc-page URL to resolve.
