---
id: QGHVXZ
slug: codex-commands-skills-vs-prompts
type: task
phase: done
status: done
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

Revalidation note: current Codex skills docs keep the same shape and add useful constraints for safeword. Codex starts with skill name, description, and path, then loads full `SKILL.md` only when selected. The initial skill list has a context budget, so safeword should keep descriptions short and focused. `agents/openai.yaml` is the right place to disable implicit invocation for action-like skills that should behave like commands.

## Done when

- One safeword skill (e.g. `verify`) ported to `.agents/skills/` and invocable in a real Codex session.
- CLI generator targets `.agents/skills` for Codex; parity-check covers it.

## Source

developers.openai.com/codex/skills

## Feature File Coverage

No source `.feature` file is required for this ticket. This is a decision ticket that resolves the Codex command surface to `.agents/skills` and records invocation policy guidance. Executable generation behavior belongs to `5DEJ8V`; any future skill-classification implementation should carry its own source feature.

## Revalidation + /figure-it-out (2026-06-13)

**Frame:** Decide how to expose safeword's Claude-style commands/workflows on Codex without bloating context or over-triggering action skills.

**Research domains checked:** Codex skill discovery, open agent skill metadata, explicit vs implicit invocation, plugin distribution, and safeword's existing action/contextual skill split.

**Options:**

1. Port safeword skills directly to `.agents/skills`, preserving `SKILL.md` as the canonical body.
2. Use custom prompts for command-like workflows.
3. Build a new MCP command surface instead of skills.

**Recommend:** Keep option 1, with one refinement: map safeword action skills to Codex skills with `agents/openai.yaml` `policy.allow_implicit_invocation: false`, while contextual guidance skills can remain implicitly invocable. This preserves command intent and avoids action skills firing from casual mentions.

**Next:** Port `verify` first, then classify every safeword skill as action vs contextual before generating `.agents/skills`.

## Work Log

- 2026-05-31 Created from Codex research.
- 2026-05-31 Read Skills doc. RESOLVED: skills in `.agents/skills` (same SKILL.md as CC). Custom-prompts-deprecation NOT confirmed — corrected.
- 2026-06-13T14:37:31Z Revalidated and ran /figure-it-out. Decision remains skills, with the added implementation rule that action-style safeword skills should disable implicit invocation via `agents/openai.yaml`.
- 2026-06-14T00:20:00Z Quality-review follow-up: completed verify record for the decision ticket. No feature source is required because executable generation behavior belongs to 5DEJ8V.
