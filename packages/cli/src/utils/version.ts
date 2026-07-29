/**
 * Version comparison utilities
 */

function onlyAsciiDigits(value: string): boolean {
  if (value.length === 0) return false;
  for (const character of value) {
    if (character < '0' || character > '9') return false;
  }
  return true;
}

function validSemverIdentifier(value: string): boolean {
  if (value.length === 0) return false;
  for (const character of value) {
    const valid =
      (character >= '0' && character <= '9') ||
      (character >= 'A' && character <= 'Z') ||
      (character >= 'a' && character <= 'z') ||
      character === '-';
    if (!valid) return false;
  }
  return true;
}

function validSemverIdentifiers(value: string): boolean {
  return value.split('.').every(identifier => validSemverIdentifier(identifier));
}

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

/** Accept a SemVer-shaped package version before interpolating it into a shell command. */
export function isSafePackageVersion(version: string): boolean {
  const [withoutBuild, ...buildParts] = version.split('+');
  if (withoutBuild === undefined || buildParts.length > 1) return false;
  const [core, ...prereleaseParts] = withoutBuild.split('-');
  if (core === undefined) return false;
  const coreParts = core.split('.');
  if (coreParts.length !== 3 || coreParts.some(part => !onlyAsciiDigits(part))) return false;
  return (
    (prereleaseParts.length === 0 || validSemverIdentifiers(prereleaseParts.join('-'))) &&
    (buildParts.length === 0 || validSemverIdentifiers(buildParts[0] ?? ''))
  );
}
