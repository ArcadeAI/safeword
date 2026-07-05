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
import { existsSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

/**
 * Agent skill directories the installer writes into (project-level). Used to
 * detect an existing install by reading reality off disk — the same
 * derive-from-disk principle as the pack manifest (no stored install state).
 */
const AGENT_SKILL_DIRS = ['.claude/skills', '.agents/skills'];

/**
 * Whether skills matching `dirPattern` (e.g. the pack's `golang-*` shape) are
 * already installed under any agent skill dir. Lets the harness install once for
 * existing projects (on upgrade) without re-pulling over the network every run.
 */
export function skillsInstalled(cwd: string, dirPattern: RegExp): boolean {
  for (const relativeDirectory of AGENT_SKILL_DIRS) {
    const dir = nodePath.join(cwd, relativeDirectory);
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      if (entries.some(entry => entry.isDirectory() && dirPattern.test(entry.name))) {
        return true;
      }
    } catch {
      // Unreadable dir — treat as "not present" and let the install attempt run.
    }
  }
  return false;
}

/**
 * How a pack tells the harness which skills to pull. Mirrors the pack manifest.
 *
 * - `'all'` → `--skill '*'`: every skill the source publishes. Right for a
 *   single-language, single-purpose source (e.g. leonardomso's Rust pack) where
 *   everything is on-topic — and drift-free, no name list to maintain.
 * - a name list → `--skill <name...>`: a curated subset, for a multi-domain
 *   source (e.g. jeffallan's ~66-skill grab-bag, where Go/Python/TS each take one
 *   language-tier skill) where `'*'` would drag in dozens of unrelated skills. The
 *   names ARE a drift surface, justified only because the source forces it; keep
 *   the list minimal (usually one language-tier skill).
 */
export type SkillSelection = 'all' | readonly string[];

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
  /** Skill source, e.g. `github.com/jeffallan/claude-skills`. */
  source: string;
  /** Selection policy from the pack manifest. */
  selection: SkillSelection;
  /** Project root to install into (project-level scope). */
  cwd: string;
}

type SkillInstallStatus = 'installed' | 'skipped' | 'failed';

export interface SkillInstallResult {
  status: SkillInstallStatus;
  /** Human-readable reason, for the setup summary. */
  detail: string;
}

/**
 * Map the pack's selection policy to the installer's skill-selection flags.
 *
 * - `'all'` → `--skill '*'`: every skill the source publishes. Note this is
 *   `--skill '*'`, NOT `--all` — `--all` also forces `--agent '*'` (every agent
 *   on earth).
 * - a name list → `--skill <name>` REPEATED per name. The installer does not
 *   accept space-separated values after one flag (same as `-a`), so each name
 *   gets its own `--skill`. An empty list selects nothing.
 */
function selectionFlags(selection: SkillSelection): string[] {
  if (selection === 'all') return ['--skill', '*'];
  return selection.flatMap(name => ['--skill', name]);
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
 * The full `npx skills add …` command as a string, for the "install later" hint
 * shown when an install fails. Derived from buildSkillsArgv so the hint can never
 * drift from the command actually run.
 */
export function skillInstallCommand(source: string, selection: SkillSelection): string {
  return buildSkillsArgv(source, selection).join(' ');
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
    const reason = Error.isError(error)
      ? (error.message.split('\n', 1)[0] ?? error.message)
      : String(error);
    return { status: 'failed', detail: reason };
  }
}
