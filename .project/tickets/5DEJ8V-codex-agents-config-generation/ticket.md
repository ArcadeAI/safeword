---
id: 5DEJ8V
slug: codex-agents-config-generation
type: feature
phase: verify
status: in_progress
epic: codex-changelog-alignment
relates_to: QM5G9M
scope:
  - Generate project-local Codex config as a safeword managed file.
  - Generate repo-scoped `.agents/skills` from existing safeword skill templates.
  - Reuse existing `AGENTS.md` generation as Codex's instruction entry point.
  - Wire only the implemented Codex PreToolUse adapter from N12G95.
out_of_scope:
  - Prompt-submit done/phase gate implementation.
  - Plugin marketplace packaging.
  - Enterprise managed `requirements.toml`.
  - Live trusted Codex-session validation.
done_when:
  - Setup tests prove `AGENTS.md`, `.codex/config.toml`, and `.agents/skills` are present.
  - Config tests prove supported PreToolUse calls point at `.safeword/hooks/codex/pre-tool-quality.ts`.
  - Upgrade tests prove an existing `.codex/config.toml` is preserved.
  - Ticket docs state that project-local hooks still require Codex trust review.
---

# Generate AGENTS.md + config.toml hook wiring for Codex

**Goal:** Have `safeword setup` produce the Codex install: `AGENTS.md` (instructions), hook wiring, and skills in `.agents/skills`.

**Why:** The CLI install path that makes safeword real on Codex, parallel to the `.claude/` and `.cursor/` generators.

## Grounded mechanics (researched 2026-05-31)

- **AGENTS.md** — loads from project root, walks up dirs; `project_doc_max_bytes` / `project_doc_fallback_filenames` configurable. Derive from SAFEWORD.md/CLAUDE.md. (Confirm nested-merge order on the AGENTS.md doc page — that exact page 404'd on first probe; resolve URL.)
- **Hook wiring** — inline `[hooks]` in `config.toml` (`~/.codex/config.toml` global, `<repo>/.codex/config.toml` project) OR `.codex/hooks.json` (global + project). All matching layers run — no override. Project config is skipped for untrusted projects (ties to trust gate, JV6D1W).
- **Skills** go in `.agents/skills/` (NOT config) — see QGHVXZ.
- **Managed/enterprise** wiring is `requirements.toml`, separate path (JV6D1W).

## Revalidated mechanics (2026-06-13)

- **AGENTS.md URL resolved** — the current page is `developers.openai.com/codex/guides/agents-md`. Codex reads global `AGENTS.override.md` or `AGENTS.md`, then project files from repo root down to cwd. Closer files win by appearing later. Default combined project-doc cap is 32 KiB.
- **Hook config shape still valid** — current hooks docs show inline TOML under `[[hooks.<Event>]]` with per-hook `type`, `command`, `timeout`, and `statusMessage`. Plugin and managed hooks are separate distribution/enforcement paths.
- **Trust is part of setup** — non-managed hooks are skipped until reviewed and trusted. Setup output must make the `/hooks` trust step visible; generation alone is not enough to activate gates.
- **Skills path still valid** — repo-scoped skills live in `.agents/skills`, and plugins are the distribution path after local authoring works.

## Done when

- `setup` emits `AGENTS.md` + hook wiring (config.toml or .codex/hooks.json) + `.agents/skills`; a fresh Codex session loads context and fires the gates.
- Reuses existing generators (`packages/cli/src/schema.ts`, `reconcile.ts`, `templates/config.ts`).

## Source

developers.openai.com/codex/config-reference, /config-advanced, /hooks, /skills

## Revalidation + /figure-it-out (2026-06-13)

**Frame:** Decide what `safeword setup` should generate first for Codex: raw project assets, a plugin, or managed configuration.

**Research domains checked:** Codex AGENTS.md discovery, project config/hook wiring, repo-scoped skill discovery, hook trust flow, managed requirements, and safeword's schema/reconcile generator model.

**Options:**

1. Generate raw project assets: `AGENTS.md`, `.codex/config.toml` or `.codex/hooks.json`, and `.agents/skills`.
2. Generate only a Codex plugin and install it locally.
3. Generate only enterprise `requirements.toml`.

**Recommend:** Use option 1 for setup. It is closest to safeword's existing Claude/Cursor install model, keeps dogfooding simple, and gives the plugin ticket concrete assets to package later. Managed requirements should be documentation/generated samples, not the default user path.

**Next:** Implement generator support after `N12G95` and `HPP49X` settle the exact hook commands and event table.

## Work Log

- 2026-05-31 Created from Codex research.
- 2026-05-31 Grounded hook-wiring locations + skills path; flagged AGENTS.md doc-page URL to resolve.
- 2026-06-13T14:37:31Z Revalidated and ran /figure-it-out. AGENTS.md doc URL is resolved; raw project asset generation remains the right first setup path. Add trust UX to setup because non-managed hooks are not active until reviewed.
- 2026-06-13T15:16:50Z Complete: intake + define-behavior + scenario-gate - promoted to feature-flow for full safeword BDD, wrote spec.md, dimensions.md, and 3 reconcile-backed scenarios. Phase -> implement.
- 2026-06-13T15:24:29Z Complete: implement - added RED setup/upgrade reconcile tests, observed the expected missing `.codex`/`.agents` failures, added managed `.codex/config.toml`, `.agents/skills` schema generation, and Codex config template. Focused schema/setup/upgrade tests passed (53 tests) and CLI lint/typecheck passed. Reconciled impl-plan.md; 0 decisions updated, 0 deviations recorded. Phase -> verify.
- 2026-06-13T15:26:54Z Verify in progress - combined Codex-focused suite passed (4 files, 56 tests), `test:smoke:fast` passed (35 files, 457 tests), CLI lint/typecheck passed, and targeted Markdown/Prettier checks passed. Ticket remains in verify; Claude `/verify` + `/audit` invocation stamps were not produced.
