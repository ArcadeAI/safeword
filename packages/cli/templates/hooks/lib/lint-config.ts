// Safeword: lint-config presence detection (ticket 1J6JKP).
//
// Prefix-match a directory listing so new eslint/prettier config extensions are
// covered without enumerating every filename — the drift that caused this
// ticket (eslint.config.ts and .prettierrc.yaml were missed). Presence only,
// not contents; a rare false positive (e.g. a `.prettierrc.bak`) merely
// suppresses a warning — far cheaper than the false negative this replaces.

// eslint flat config (`eslint.config.{js,mjs,cjs,ts,mts,cts}`) + legacy
// `.eslintrc*`. prettier: `.prettierrc*` (every extension) + `prettier.config.*`.
const ESLINT_CONFIG_PREFIXES = ['eslint.config.', '.eslintrc'];
const PRETTIER_CONFIG_PREFIXES = ['.prettierrc', 'prettier.config.'];

function hasPrefixMatch(entries: readonly string[], prefixes: readonly string[]): boolean {
  return entries.some(name => prefixes.some(prefix => name.startsWith(prefix)));
}

export function detectEslintConfig(entries: readonly string[]): boolean {
  return hasPrefixMatch(entries, ESLINT_CONFIG_PREFIXES);
}

export function detectPrettierConfig(entries: readonly string[]): boolean {
  return hasPrefixMatch(entries, PRETTIER_CONFIG_PREFIXES);
}
