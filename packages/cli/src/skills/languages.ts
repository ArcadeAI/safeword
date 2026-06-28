/**
 * Language Skill Delivery (harness)
 *
 * The language-general successor to the Go-only `golang.ts`. Holds ONE registry
 * mapping a language id to its skill manifest (source + selection + on-disk
 * presence pattern), plus generic install/ensure entry points that `setup` and
 * `upgrade` call. Adding a language is a registry row, not a new module.
 *
 * Dependency is harness → pack (pull): this reads each pack's pure skill manifest;
 * the packs know nothing of it.
 */

import {
  GOLANG_SKILL_DIR_PATTERN,
  GOLANG_SKILL_SELECTION,
  GOLANG_SKILL_SOURCE,
} from '../packs/golang/skills.js';
import {
  PYTHON_SKILL_DIR_PATTERN,
  PYTHON_SKILL_SELECTION,
  PYTHON_SKILL_SOURCE,
} from '../packs/python/skills.js';
import { detectLanguages } from '../packs/registry.js';
import {
  RUST_SKILL_DIR_PATTERN,
  RUST_SKILL_SELECTION,
  RUST_SKILL_SOURCE,
} from '../packs/rust/skills.js';
import {
  TYPESCRIPT_SKILL_DIR_PATTERN,
  TYPESCRIPT_SKILL_SELECTION,
  TYPESCRIPT_SKILL_SOURCE,
} from '../packs/typescript/skills.js';
import { info, success, warn } from '../utils/output.js';
import {
  installSkills,
  skillInstallCommand,
  type SkillInstallResult,
  type SkillSelection,
  skillsInstalled,
} from './install.js';

/** A language's skill-delivery declaration, assembled from its pack manifest. */
export interface LanguageSkillManifest {
  /** Pack id, matches the registry key and `detectLanguages` output (e.g. `golang`). */
  langId: string;
  /** Human label for user-facing messaging (e.g. `Go`). */
  label: string;
  /** Skill source repo. */
  source: string;
  /** Selection policy ('all' or a named subset). */
  selection: SkillSelection;
  /** On-disk dir-name pattern, for presence-gated upgrades. */
  dirPattern: RegExp;
}

/**
 * Every language that ships coding skills, keyed by pack id. The ONLY place a new
 * language's skill source is wired — `setup`/`upgrade` iterate this generically.
 */
export const LANGUAGE_SKILL_MANIFESTS: Readonly<Record<string, LanguageSkillManifest>> = {
  golang: {
    langId: 'golang',
    label: 'Go',
    source: GOLANG_SKILL_SOURCE,
    selection: GOLANG_SKILL_SELECTION,
    dirPattern: GOLANG_SKILL_DIR_PATTERN,
  },
  python: {
    langId: 'python',
    label: 'Python',
    source: PYTHON_SKILL_SOURCE,
    selection: PYTHON_SKILL_SELECTION,
    dirPattern: PYTHON_SKILL_DIR_PATTERN,
  },
  typescript: {
    langId: 'typescript',
    label: 'TypeScript',
    source: TYPESCRIPT_SKILL_SOURCE,
    selection: TYPESCRIPT_SKILL_SELECTION,
    dirPattern: TYPESCRIPT_SKILL_DIR_PATTERN,
  },
  rust: {
    langId: 'rust',
    label: 'Rust',
    source: RUST_SKILL_SOURCE,
    selection: RUST_SKILL_SELECTION,
    dirPattern: RUST_SKILL_DIR_PATTERN,
  },
};

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
 * Setup path: install skills for every detected language that ships them. Called
 * once after pack reconciliation.
 */
export function installDetectedLanguageSkills(cwd: string): void {
  // installLanguageSkills no-ops (returns undefined, no message) for a detected
  // language with no skill manifest, so no membership guard is needed here.
  for (const langId of detectLanguages(cwd)) installLanguageSkills(langId, cwd);
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
