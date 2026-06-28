/**
 * Python Language Pack — Skill Manifest (pure declaration)
 *
 * Like the Go manifest, this DECLARES where Python judgment skills come from and
 * how to select them; the harness CONSUMES it (harness → pack pull). It knows
 * nothing of prompts, hooks, or timing.
 *
 * Source: jeffallan/claude-skills (MIT) — a multi-language author, NOT a
 * Python-dedicated pack. So selection is a NAMED subset (`python-pro`, the
 * language-tier skill), not `'*'`: `'*'` would pull all ~66 unrelated skills
 * (angular, dotnet, …). One name is a small, deliberate drift surface, justified
 * because the source is a grab-bag — verified to install as `.claude/skills/
 * python-pro/`.
 *
 * NOTE: efficacy is not yet probed. The pack is wired for delivery; whether
 * `python-pro` measurably changes agent behavior is the headroom-probe gate
 * (#538 Done-when, see `.project/learnings/skill-pack-efficacy-gate.md`).
 */

/** Where the skills come from. The harness owns the install command + ref policy. */
export const PYTHON_SKILL_SOURCE = 'github.com/jeffallan/claude-skills';

/**
 * Named selection: the single language-tier skill. A name list (not `'all'`)
 * because the source is multi-domain; kept to one entry to minimize the drift a
 * name list carries.
 */
export const PYTHON_SKILL_SELECTION: readonly string[] = ['python-pro'];

/**
 * Directory-name shape the installed skill follows (`python-pro`). The harness
 * uses this to detect an existing install on disk (presence-gated upgrades).
 */
export const PYTHON_SKILL_DIR_PATTERN = /^python-pro$/;
