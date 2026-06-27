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

/**
 * Check if latest version is newer than current
 * @param current
 * @param latest
 */
export function isNewerVersion(current: string, latest: string): boolean {
  return compareVersions(current, latest) === -1;
}

const REGISTRY_TIMEOUT_MS = 3000;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Type guard for a comparable semver string (e.g. `"1.2.3"`). Use before
 * passing a registry- or cache-sourced value into {@link compareVersions},
 * which silently produces `NaN` comparisons on malformed input.
 * @param value
 */
export function isComparableVersion(value: unknown): value is string {
  return typeof value === 'string' && VERSION_PATTERN.test(value);
}

/**
 * Fetch the latest published safeword version from the npm registry.
 * Returns undefined on network error, timeout, non-OK response, or an
 * unparseable/invalid version — callers treat undefined as "unknown".
 * @param timeout milliseconds before the request is aborted
 */
export async function fetchRegistryLatestVersion(
  timeout = REGISTRY_TIMEOUT_MS,
): Promise<string | undefined> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch('https://registry.npmjs.org/safeword/latest', {
      signal: controller.signal,
    });
    if (!response.ok) return undefined;

    const data = (await response.json()) as { version?: unknown };
    return isComparableVersion(data.version) ? data.version : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeoutId);
  }
}
