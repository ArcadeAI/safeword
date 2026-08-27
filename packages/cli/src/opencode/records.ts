export function exactRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  const keys = Object.keys(record);
  if (
    requiredKeys.some(key => !Object.hasOwn(record, key)) ||
    keys.some(key => !allowed.has(key))
  ) {
    return undefined;
  }
  return record;
}

export function matchesRecord(
  record: Record<string, unknown> | undefined,
  validators: Readonly<Record<string, (value: unknown) => boolean>>,
): record is Record<string, unknown> {
  return (
    record !== undefined &&
    Object.entries(validators).every(([key, validate]) => validate(record[key]))
  );
}

export function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d]{64}$/u.test(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}
