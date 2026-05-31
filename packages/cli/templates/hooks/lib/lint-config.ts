// Safeword: lint-config presence detection (ticket 1J6JKP).
//
// Match the EXACT set of config filenames each tool resolves — not a loose
// prefix. Prefix-matching was the first attempt but it false-positives on a
// `.bak`/disabled config (`eslint.config.mjs.bak`, `.prettierrc.bak`): the tool
// won't load those, so they must read as "missing". The extension lists below
// are the complete current sets (eslint flat + eslintrc, prettier rc + config);
// a new extension is a one-line add — the drift this replaces was an
// *incomplete* list (`.ts`/`.yaml` were missing), not enumeration itself.

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
