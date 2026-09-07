import { createHash } from 'node:crypto';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => canonicalize(item));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

export function digestLocalRetroReadinessManifest(manifest: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(manifest)))
    .digest('hex');
}
