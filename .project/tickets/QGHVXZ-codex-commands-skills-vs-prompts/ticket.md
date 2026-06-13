---
id: QGHVXZ
slug: codex-commands-skills-vs-prompts
type: task
phase: intake
status: in_progress
epic: codex-changelog-alignment
relates_to: QM5G9M
---

# Codex commands surface: skills (RESOLVED → skills)

**Goal:** Ship safeword's commands/workflows on Codex as **skills** in `.agents/skills/`.

**Decision (researched 2026-05-31):** Build as skills, not `~/.codex/prompts/`. Skills are Codex's authoring format for reusable workflows and the unit plugins distribute; they use the **open agent skills standard** — a `SKILL.md` with `name`/`description` frontmatter, optional `scripts/`/`references/`/`assets/`/`agents/openai.yaml`. **This is the same `SKILL.md` format safeword already ships for Claude Code** (`.claude/skills/*/SKILL.md`), so the existing skills likely port with minimal change — the big synergy.

**Correction to earlier note:** the "custom prompts deprecated" claim is **not** confirmed — the Skills doc carries no deprecation notice. Skills win on merits (modern format + plugin distribution + cross-tool standard), not because prompts are dead.

## Mechanics (from /codex/skills)

- Discovery precedence: repo `.agents/skills` (CWD→root), `$HOME/.agents/skills`, `/etc/codex/skills` (admin), bundled.
- Invocation: explicit via `/skills` or `$name` mention; implicit auto-selection by description (disable per-skill with `allow_implicit_invocation: false` in `agents/openai.yaml`).

## Done when

- One safeword skill (e.g. `verify`) ported to `.agents/skills/` and invocable in a real Codex session.
- CLI generator targets `.agents/skills` for Codex; parity-check covers it.

## Source

developers.openai.com/codex/skills

## Work Log

- 2026-05-31 Created from Codex research.
- 2026-05-31 Read Skills doc. RESOLVED: skills in `.agents/skills` (same SKILL.md as CC). Custom-prompts-deprecation NOT confirmed — corrected.
