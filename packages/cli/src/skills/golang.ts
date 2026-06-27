/**
 * Go Skill Delivery (harness)
 *
 * Ties the Go pack's skill manifest (pure data) to the generic skill installer
 * and presents the outcome. Both `setup` and `upgrade` call through here so the
 * install command, agent targeting, and user-facing messaging live in one place.
 * Dependency is harness → pack (pull): this reads the manifest; the pack knows
 * nothing of it.
 */

import {
  GOLANG_SKILL_DIR_PATTERN,
  GOLANG_SKILL_SELECTION,
  GOLANG_SKILL_SOURCE,
} from '../packs/golang/skills.js';
import { info, success, warn } from '../utils/output.js';
import { installSkills, type SkillInstallResult, skillsInstalled } from './install.js';

const MANUAL_INSTALL_HINT =
  "  Install later: npx skills add github.com/samber/cc-skills-golang --skill '*' " +
  '-a claude-code -a codex -a cursor --copy -y';

/**
 * Pull the Go judgment skills and report the outcome. Best-effort: a failure
 * degrades to a warning (never throws), so it can't block the surrounding flow.
 */
export function installGoSkills(cwd: string): SkillInstallResult {
  const result = installSkills({
    source: GOLANG_SKILL_SOURCE,
    selection: GOLANG_SKILL_SELECTION,
    cwd,
  });
  switch (result.status) {
    case 'installed': {
      success(`Installed Go coding skills (${result.detail})`);
      break;
    }
    case 'skipped': {
      info(`Skipped Go coding skills (${result.detail})`);
      break;
    }
    case 'failed': {
      warn(`Could not install Go coding skills — continuing without them (${result.detail}).`);
      info(MANUAL_INSTALL_HINT);
      break;
    }
  }
  return result;
}

/**
 * Upgrade path: install Go skills only when a Go project doesn't already have
 * them. Existing projects pick the skills up once (on their next upgrade); after
 * that the on-disk presence check short-circuits, so upgrades stay fast and make
 * no network call. Refreshing installed skills to latest is a separate action.
 */
export function ensureGoSkills(cwd: string, isGoProject: boolean): void {
  if (!isGoProject) return;
  if (skillsInstalled(cwd, GOLANG_SKILL_DIR_PATTERN)) return;
  installGoSkills(cwd);
}
