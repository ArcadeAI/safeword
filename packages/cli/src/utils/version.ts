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

interface ParsedSemver {
  readonly core: readonly [string, string, string];
  readonly prerelease: readonly string[];
}

type Comparison = -1 | 0 | 1;

function hasForbiddenLeadingZero(value: string): boolean {
  return value.length > 1 && value.startsWith('0');
}

function parseCore(value: string): ParsedSemver['core'] | undefined {
  const parts = value.split('.');
  if (
    parts.length !== 3 ||
    parts.some(part => !onlyAsciiDigits(part) || hasForbiddenLeadingZero(part))
  ) {
    return undefined;
  }
  return parts as [string, string, string];
}

function parseIdentifiers(
  value: string,
  forbidNumericLeadingZeros: boolean,
): readonly string[] | undefined {
  if (!validSemverIdentifiers(value)) return undefined;
  const identifiers = value.split('.');
  if (
    forbidNumericLeadingZeros &&
    identifiers.some(
      identifier => onlyAsciiDigits(identifier) && hasForbiddenLeadingZero(identifier),
    )
  ) {
    return undefined;
  }
  return identifiers;
}

function parseSemver(version: string): ParsedSemver | undefined {
  const buildParts = version.split('+');
  if (buildParts.length > 2) return undefined;
  const withoutBuild = buildParts[0] ?? '';
  const build = buildParts[1];
  if (build !== undefined && parseIdentifiers(build, false) === undefined) return undefined;

  const prereleaseSeparator = withoutBuild.indexOf('-');
  const coreText =
    prereleaseSeparator === -1 ? withoutBuild : withoutBuild.slice(0, prereleaseSeparator);
  const prereleaseText =
    prereleaseSeparator === -1 ? undefined : withoutBuild.slice(prereleaseSeparator + 1);
  const core = parseCore(coreText);
  if (core === undefined) return undefined;
  const prerelease = prereleaseText === undefined ? [] : parseIdentifiers(prereleaseText, true);
  return prerelease === undefined ? undefined : { core, prerelease };
}

function compareNumeric(left: string, right: string): Comparison {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return 0;
}

function comparePrereleaseIdentifier(left: string, right: string): Comparison {
  if (left === right) return 0;
  const leftNumeric = onlyAsciiDigits(left);
  const rightNumeric = onlyAsciiDigits(right);
  if (leftNumeric && rightNumeric) return compareNumeric(left, right);
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left < right ? -1 : 1;
}

function comparePrerelease(left: readonly string[], right: readonly string[]): Comparison {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;

  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const leftIdentifier = left[index];
    if (leftIdentifier === undefined) return -1;
    const rightIdentifier = right[index];
    if (rightIdentifier === undefined) return 1;
    const comparison = comparePrereleaseIdentifier(leftIdentifier, rightIdentifier);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function compareCore(left: ParsedSemver['core'], right: ParsedSemver['core']): Comparison {
  for (let index = 0; index < 3; index++) {
    const comparison = compareNumeric(left[index] ?? '0', right[index] ?? '0');
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function compareLegacyVersions(left: string, right: string): Comparison {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }
  return 0;
}

/**
 * Compare SemVer versions. Legacy non-SemVer inputs retain numeric-core comparison
 * so downgrade protection remains conservative for older project markers.
 *
 * Safety gates must validate both inputs with `isSafePackageVersion` before calling
 * this function: the compatibility fallback cannot distinguish equal numeric cores
 * from wholly unparseable input.
 * @param a
 * @param b
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): Comparison {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  if (parsedA === undefined || parsedB === undefined) return compareLegacyVersions(a, b);
  const coreComparison = compareCore(parsedA.core, parsedB.core);
  return coreComparison === 0
    ? comparePrerelease(parsedA.prerelease, parsedB.prerelease)
    : coreComparison;
}

/** Accept a SemVer-shaped package version before interpolating it into a shell command. */
export function isSafePackageVersion(version: string): boolean {
  return parseSemver(version) !== undefined;
}
