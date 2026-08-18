/**
 * Language Skill Delivery (harness)
 *
 * The language-general successor to the Go-only `golang.ts`. Holds ONE registry
 * mapping a language id to its skill manifest (source + selection + on-disk
 * presence pattern), plus generic install/ensure entry points that `setup` and
 * `upgrade` call.
 *
 * The registry is DERIVED from the pack registry, not hand-written: a pack that
 * declares `skills` is wired automatically, and its id/label come from the pack's
 * own `id`/`name` rather than being re-stated here. Adding a language is one
 * `LANGUAGE_PACKS` row plus that pack's `skills.ts` — nothing to edit in this file.
 *
 * Dependency is harness → pack (pull): this reads each pack's pure skill manifest;
 * the packs know nothing of it.
 */

import { detectLanguages, LANGUAGE_PACKS } from '../packs/registry.js';
import type { PackSkillManifest } from '../packs/types.js';
import { info, success, warn } from '../utils/output.js';
import {
  installSkills,
  skillInstallCommand,
  type SkillInstallResult,
  skillsInstalled,
} from './install.js';

/**
 * A language's skill-delivery declaration: the pack's own manifest plus the
 * identity the harness needs for messaging. Assembled by `buildManifests`.
 */
export interface LanguageSkillManifest extends PackSkillManifest {
  /** Pack id, matches the registry key and `detectLanguages` output (e.g. `golang`). */
  langId: string;
  /** Human label for user-facing messaging (e.g. `Go`), taken from the pack's `name`. */
  label: string;
}

function buildManifests(): Readonly<Record<string, LanguageSkillManifest>> {
  const manifests: Record<string, LanguageSkillManifest> = {};
  for (const pack of Object.values(LANGUAGE_PACKS)) {
    if (!pack.skills) continue;
    manifests[pack.id] = { ...pack.skills, langId: pack.id, label: pack.name };
  }
  return manifests;
}

/**
 * Every language that ships coding skills, keyed by pack id — derived from the
 * packs that declare a `skills` manifest. `setup`/`upgrade` iterate it generically.
 */
export const LANGUAGE_SKILL_MANIFESTS: Readonly<Record<string, LanguageSkillManifest>> =
  buildManifests();

/**
 * Pull one language's coding skills and report the outcome. Best-effort: a
 * failure degrades to a warning (never throws), so it can't block setup/upgrade.
 * Returns undefined for a language with no skill manifest.
 */
export function installLanguageSkills(langId: string, cwd: string): SkillInstallResult | undefined {
  const manifest = LANGUAGE_SKILL_MANIFESTS[langId];
  if (!manifest) return undefined;

  const result = installSkills({ source: manifest.source, selection: manifest.selection, cwd });
  switch (result.status) {
    case 'installed': {
      success(`Installed ${manifest.label} coding skills (${result.detail})`);
      break;
    }
    case 'skipped': {
      info(`Skipped ${manifest.label} coding skills (${result.detail})`);
      break;
    }
    case 'failed': {
      warn(
        `Could not install ${manifest.label} coding skills — continuing without them (${result.detail}).`,
      );
      info(`  Install later: ${skillInstallCommand(manifest.source, manifest.selection)}`);
      break;
    }
  }
  return result;
}

/**
 * Upgrade path: install skills only for detected languages that don't already
 * have them. Reaches projects set up before a language's skills existed; the
 * on-disk presence check keeps repeat upgrades network-free. Refreshing installed
 * skills to latest is a separate action.
 */
export function ensureLanguageSkills(cwd: string): void {
  for (const langId of detectLanguages(cwd)) {
    const manifest = LANGUAGE_SKILL_MANIFESTS[langId];
    if (!manifest) continue;
    if (skillsInstalled(cwd, manifest.dirPattern)) continue;
    installLanguageSkills(langId, cwd);
  }
}
