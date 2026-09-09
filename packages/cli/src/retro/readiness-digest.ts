import { createHash } from 'node:crypto';

function compareKeys([left]: [string, unknown], [right]: [string, unknown]): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => canonicalize(item));
  if (typeof value !== 'object' || value === null) return value;
  // eslint-disable-next-line unicorn/no-array-sort -- The shipped CLI still targets Node 18.
  const entries = Object.entries(value).sort(compareKeys);
  return Object.fromEntries(entries.map(([key, item]) => [key, canonicalize(item)]));
}

export function digestLocalRetroReadinessManifest(manifest: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(manifest)))
    .digest('hex');
}
