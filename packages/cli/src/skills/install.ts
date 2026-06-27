/**
 * Skill Package Installer (harness consumer)
 *
 * The harness side of the pack/harness split: a language pack DECLARES a skill
 * source + selection policy (pure data, e.g. `packs/golang/skills.ts`); this
 * module CONSUMES that declaration and performs the side-effecting install.
 * Dependency is harness → pack (pull) — packs never import this.
 *
 * Delivery is delegated to the upstream `skills` CLI (vercel-labs/skills) via
 * `npx`, so safeword maintains no skill content and no skill-name list. The
 * install is best-effort: a missing network, missing `npx`, or installer error
 * DEGRADES (returns a status) rather than failing the surrounding setup.
 */

import { execFileSync } from 'node:child_process';

/** How a pack tells the harness which skills to pull. Mirrors the pack manifest. */
export type SkillSelection = 'all';

/**
 * Agent platforms safeword installs skills for, by the upstream installer's IDs.
 * Unlike skill names, this is a SMALL, STABLE, hand-picked set — exactly the
 * agents safeword supports — so it is not a drift risk and is owned by the
 * harness (agent targeting is cross-language, not a per-pack concern).
 *
 * Crucially we do NOT pass `--all`/`--agent '*'`: that shorthand fans out to
 * EVERY agent the installer knows (~48 of them, ~175MB of duplicated skill
 * copies). Targeting our agents installs only what we support — the installer
 * maps `claude-code` → `.claude/skills/` and both `codex` and `cursor` →
 * `.agents/skills/`, so a full install lands in two directories, ~7MB.
 */
export const SAFEWORD_SKILL_AGENTS = ['claude-code', 'codex', 'cursor'] as const;

export interface InstallSkillsOptions {
  /** Skill source, e.g. `github.com/samber/cc-skills-golang`. */
  source: string;
  /** Selection policy from the pack manifest. */
  selection: SkillSelection;
  /** Project root to install into (project-level scope). */
  cwd: string;
}

export type SkillInstallStatus = 'installed' | 'skipped' | 'failed';

export interface SkillInstallResult {
  status: SkillInstallStatus;
  /** Human-readable reason, for the setup summary. */
  detail: string;
}

/**
 * Map the pack's selection policy to the installer's skill-selection flags.
 *
 * - `all` → `--skill '*'`: every skill the source publishes, with no skill-name
 *   list to enumerate or maintain (the drift we refuse). Note this is `--skill
 *   '*'`, NOT `--all` — `--all` also forces `--agent '*'` (every agent on earth).
 */
function selectionFlags(selection: SkillSelection): string[] {
  // Only 'all' exists today; a future curated mode would branch here (and would
  // reintroduce a skill-name list — the drift we deliberately avoid).
  return selection === 'all' ? ['--skill', '*'] : [];
}

/**
 * Build the argv for the upstream installer. Pure (no side effects) so the
 * command shape is unit-testable without touching the network.
 *
 * `npx -y` bootstraps the `skills` CLI itself if absent. `-a <id>` is repeated
 * per agent (the installer does NOT split a comma/space list). `--copy` writes
 * real files into the agent skill dirs instead of symlinking into an ephemeral
 * npx/store path, so the installed skills are portable, reviewable, and survive
 * across machines/CI. Trailing `-y` keeps it non-interactive.
 */
export function buildSkillsArgv(
  source: string,
  selection: SkillSelection,
  agents: readonly string[] = SAFEWORD_SKILL_AGENTS,
): string[] {
  const agentFlags = agents.flatMap(agent => ['-a', agent]);
  return [
    'npx',
    '-y',
    'skills@latest',
    'add',
    source,
    ...selectionFlags(selection),
    ...agentFlags,
    '--copy',
    '-y',
  ];
}

/**
 * Install a skill package into the project. Best-effort; never throws.
 *
 * Skips the network call when either `SAFEWORD_SKIP_INSTALL` (the project-wide
 * "no installs" switch, parity with the Python/JS dependency installers) or
 * `SAFEWORD_SKIP_SKILLS` (skip ONLY the skills pull, keeping dependency installs)
 * is set — useful in tests and offline setup.
 */
export function installSkills(options: InstallSkillsOptions): SkillInstallResult {
  if (process.env.SAFEWORD_SKIP_INSTALL) {
    return { status: 'skipped', detail: 'SAFEWORD_SKIP_INSTALL set' };
  }
  if (process.env.SAFEWORD_SKIP_SKILLS) {
    return { status: 'skipped', detail: 'SAFEWORD_SKIP_SKILLS set' };
  }

  // First token is always 'npx'; the default keeps the type non-optional.
  const [command = 'npx', ...argv] = buildSkillsArgv(options.source, options.selection);

  try {
    // execFileSync (no shell) so the literal `*` in `--skill '*'` reaches the
    // installer instead of being glob-expanded against cwd.
    execFileSync(command, argv, {
      cwd: options.cwd,
      stdio: 'pipe',
      // Cloning the source + copying ~40 skills can be slow; bound it so setup
      // never hangs. A timeout surfaces as a caught failure (degrade-not-fail).
      timeout: 120_000,
    });
    return { status: 'installed', detail: options.source };
  } catch (error) {
    const reason =
      error instanceof Error ? (error.message.split('\n', 1)[0] ?? error.message) : String(error);
    return { status: 'failed', detail: reason };
  }
}
