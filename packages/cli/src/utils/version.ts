/**
 * Version comparison utilities
 */

/**
 * Compare two semver versions
 * @param a
 * @param b
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const aValue = aParts[i] ?? 0;
    const bValue = bParts[i] ?? 0;
    if (aValue < bValue) return -1;
    if (aValue > bValue) return 1;
  }

  return 0;
}
