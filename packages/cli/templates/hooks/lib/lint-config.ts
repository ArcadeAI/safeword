// Safeword: lint-config presence detection (ticket 1J6JKP).
//
// Match the EXACT set of config filenames each tool resolves — not a loose
// prefix. Prefix-matching was the first attempt but it false-positives on a
// `.bak`/disabled config (`eslint.config.mjs.bak`, `.prettierrc.bak`): the tool
// won't load those, so they must read as "missing". The extension lists below
// are the complete current sets (eslint flat + eslintrc, prettier rc + config);
// a new extension is a one-line add — the drift this replaces was an
// *incomplete* list (`.ts`/`.yaml` were missing), not enumeration itself.

import { readdirSync } from 'node:fs';

const ESLINT_FLAT_EXTENSIONS = ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts'];
const ESLINT_RC_EXTENSIONS = ['js', 'cjs', 'yaml', 'yml', 'json'];
const PRETTIER_RC_EXTENSIONS = [
  'json',
  'yaml',
  'yml',
  'json5',
  'toml',
  'js',
  'cjs',
  'mjs',
  'ts',
  'cts',
  'mts',
];
const PRETTIER_CONFIG_EXTENSIONS = ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'];

const ESLINT_CONFIG_FILES = new Set<string>([
  ...ESLINT_FLAT_EXTENSIONS.map(extension => `eslint.config.${extension}`),
  '.eslintrc',
  ...ESLINT_RC_EXTENSIONS.map(extension => `.eslintrc.${extension}`),
]);

const PRETTIER_CONFIG_FILES = new Set<string>([
  '.prettierrc',
  ...PRETTIER_RC_EXTENSIONS.map(extension => `.prettierrc.${extension}`),
  ...PRETTIER_CONFIG_EXTENSIONS.map(extension => `prettier.config.${extension}`),
]);

export function detectEslintConfig(entries: readonly string[]): boolean {
  return entries.some(name => ESLINT_CONFIG_FILES.has(name));
}

export function detectPrettierConfig(entries: readonly string[]): boolean {
  return entries.some(name => PRETTIER_CONFIG_FILES.has(name));
}

// Non-Prettier JS/TS formatters that own a repo's formatting. When one is
// present the lint hook skips Prettier rather than fight it (ticket V7GGJZ).
// Exact-filename match, mirroring ALTERNATIVE_FORMATTER_FILES in
// presets/typescript/detect.ts — the `cli-presets-self-contained` rule forbids
// importing it, so the two are kept in sync by hand. oxfmt config set per oxc
// docs; deno uses deno.json(c).
const OXFMT_CONFIG_EXTENSIONS = ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'];
const ALTERNATIVE_FORMATTER_FILES = new Set<string>([
  // Biome (and legacy Rome)
  'biome.json',
  'biome.jsonc',
  'rome.json',
  // dprint
  'dprint.json',
  '.dprint.json',
  'dprint.jsonc',
  '.dprint.jsonc',
  // oxfmt (oxc formatter)
  '.oxfmtrc.json',
  '.oxfmtrc.jsonc',
  ...OXFMT_CONFIG_EXTENSIONS.map(extension => `oxfmt.config.${extension}`),
  // deno fmt
  'deno.json',
  'deno.jsonc',
]);

export function detectAlternativeFormatter(entries: readonly string[]): boolean {
  return entries.some(name => ALTERNATIVE_FORMATTER_FILES.has(name));
}

/**
 * Whether a non-Prettier formatter owns this project's formatting — the gate the
 * lint hook uses to skip Prettier (ticket V7GGJZ). Reads the project root once;
 * a read failure (e.g. missing dir) reads as "not owned" so the hook stays
 * additive and never throws on a malformed path.
 */
export function projectOwnsAlternativeFormatter(projectDirectory: string): boolean {
  try {
    return detectAlternativeFormatter(readdirSync(projectDirectory));
  } catch {
    return false;
  }
}

/**
 * Whether the session lint check should warn that Prettier is missing. It must
 * not nag a repo that deliberately uses a non-Prettier formatter — those shops
 * don't want Prettier installed (ticket V7GGJZ).
 */
export function shouldWarnMissingPrettier(entries: readonly string[]): boolean {
  return !detectAlternativeFormatter(entries) && !detectPrettierConfig(entries);
}
