import type { Effect } from './result.js';

export function diffFileSnapshots(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): Effect[] {
  const effects: Effect[] = [];
  for (const [target, content] of after) {
    const previous = before.get(target);
    if (previous === undefined) effects.push({ kind: 'create', target });
    else if (previous !== content) effects.push({ kind: 'update', target });
  }
  for (const target of before.keys()) {
    if (!after.has(target)) effects.push({ kind: 'delete', target });
  }
  return effects;
}
