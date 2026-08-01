export function stringOption(
  options: Readonly<Record<string, unknown>>,
  name: string,
): string | undefined {
  const value = options[name];
  return typeof value === 'string' ? value : undefined;
}

export function numericOption(
  options: Readonly<Record<string, unknown>>,
  name: string,
): number | undefined {
  const value = options[name];
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
