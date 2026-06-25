/**
 * Shared reader for a package.json's dependency names — the architecture
 * fingerprint (drift signal) and the monorepo model (inter-package edges) both
 * collect the *keys* across every dependency section, so the section list and the
 * collection loop live in one place (ticket ZD70P1, factored out during verify).
 */

/** package.json dependency manifest sections whose *keys* are dependency names. */
const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

/** The dependency names (keys) across all dependency sections of a parsed manifest. */
export function dependencySectionNames(manifest: Record<string, unknown>): string[] {
  const names = new Set<string>();
  for (const section of DEPENDENCY_SECTIONS) {
    const entry = manifest[section];
    if (entry !== null && typeof entry === 'object') {
      for (const name of Object.keys(entry)) names.add(name);
    }
  }
  return [...names];
}
