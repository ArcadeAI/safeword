// Safeword: lint-config presence detection (ticket 1J6JKP) — RED stub.
// Real bodies land in the GREEN commit.

export function detectEslintConfig(entries: readonly string[]): boolean {
  throw new Error(`not implemented: detectEslintConfig(${entries.length})`);
}

export function detectPrettierConfig(entries: readonly string[]): boolean {
  throw new Error(`not implemented: detectPrettierConfig(${entries.length})`);
}
