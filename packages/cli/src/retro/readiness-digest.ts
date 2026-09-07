import { createHash } from 'node:crypto';

function compareKeys([left]: [string, unknown], [right]: [string, unknown]): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => canonicalize(item));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(compareKeys)
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

export function digestLocalRetroReadinessManifest(manifest: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(manifest)))
    .digest('hex');
}
