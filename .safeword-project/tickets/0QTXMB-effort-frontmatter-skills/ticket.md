---
id: 0QTXMB
slug: effort-frontmatter-skills
type: task
phase: done
status: done
epic: cc-changelog-alignment
relates_to: 8R54HV
created: 2026-05-31T21:05:09.536Z
last_modified: 2026-06-05T17:34:00.000Z
---

# Per-skill `effort: low` on tool-driven skills

**Goal:** Lower reasoning effort on safeword's genuinely tool-driven skills (`lint`, `cleanup-zombies`) so they don't burn reasoning the linters / kill-commands do anyway. Leave reasoning skills unset so the user's session `/effort` controls them.

**Why:** Claude Code exposes per-skill `effort:` frontmatter. On tool-driven skills the model only orchestrates deterministic tools, so `effort: low` saves tokens with no quality loss. (The original ambition — a "high" tier to _boost_ reasoning skills — is a no-op-or-harmful on a default-high session; see revalidation.)

## Revalidation (2026-06-05, CC 2.1.161 — was planned against 2.1.120–2.1.154)

Mechanism re-verified current against CC docs:

- Skill `effort:` frontmatter exists; values `low/medium/high/xhigh/max` on Opus 4.8. ([skills.md](https://code.claude.com/docs/en/skills.md#frontmatter-reference))
- Hooks receive `effort.level` + `$CLAUDE_EFFORT`; Bash commands get `$CLAUDE_EFFORT`. ([hooks.md](https://code.claude.com/docs/en/hooks.md))
- **Precedence (the decisive finding):** env var > frontmatter `effort:` > session/`/effort` > model default. Frontmatter is an **absolute override** of the session level, **not a floor**. ([model-config.md](https://code.claude.com/docs/en/model-config.md#adjust-effort-level))

**Consequence on a default-high (Opus 4.8) session:**

- `effort: low` → genuinely lowers reasoning (cost saving). ✓ the only useful lever.
- `effort: high`/`medium` → no-op (session is already ≥ that).
- `effort: high` on a **reasoning** skill → **harmful**: caps it below a user's `/effort xhigh`, stealing their control.

This invalidates the original 3-tier mapping. Rescoped below (via `/figure-it-out`).

## Scope

- Add `effort: low` to the frontmatter of **`lint`** and **`cleanup-zombies`** — both tool-driven (linters / kill-commands do the work; the model only orchestrates). Mirror across `packages/cli/templates/skills/` ↔ `.claude/skills/` (byte-identical).
- Leave **all reasoning skills unset** (`debug`, `figure-it-out`, `quality-review`, `audit`, `tdd-review`, `bdd`, `refactor`, `testing`, `verify`, `ticket-system`, `versioning`) → they inherit the session effort, so the user's `/effort` (incl. `xhigh`) controls them.

## Out of scope

- The 3-tier mapping's "High"/"Default" tiers — no-op or reasoning-capping; rejected.
- Hook-side `$CLAUDE_EFFORT` gate-scaling — scaling gate strictness by effort is niche behavior for real complexity; doesn't earn its keep. **Decision: no.**
- Model selection (effort ≠ model).

## Done when

- `lint` and `cleanup-zombies` SKILL.md carry `effort: low` in both copies (template + dogfood), byte-identical (parity green).
- No reasoning skill has `effort:` set (user `/effort` retains control).
- Hook-scaling decision recorded (no). Full suite + lint green.

## Work Log

- 2026-05-31T21:05:09.536Z Started: Created ticket 0QTXMB
- 2026-05-31 Confirmed no skill sets effort and no hook reads $CLAUDE_EFFORT.
- 2026-06-05T17:18:00.000Z Revalidated (CC 2.1.161) + rescoped via `/figure-it-out`. Mechanism still current, but frontmatter is an absolute override (not a floor): the original 3-tier mapping was a no-op (high/default tiers) and harmful (capping reasoning skills below `/effort xhigh`). Rescoped to the one real lever — `effort: low` on the two tool-driven skills (`lint`, `cleanup-zombies`); reasoning skills left unset; hook-scaling rejected. Implemented the 4 frontmatter edits (both copies; parity test green).
- 2026-06-05T17:34:00.000Z Verified + done. `/verify`: full suite **2488/2488 green**, build ✅, lint ✅, dep-drift clean, parity green (630 skill/reconcile/schema tests accept the new field). `/quality-review` APPROVE (change is a no-op-if-wrong, zero downside). verify.md written. PR #195. Status → done.
