import { strict as assert } from 'node:assert';

/** Read the actual missing phases, not the canonical sequence in recovery advice. */
export function missingPhases(text: string): string[] {
  const match = /Phases still needing justification: ([^.\n]+)\./u.exec(text);
  const list = match?.[1];
  assert.ok(list, `Expected a missing-phase list in denial:\n${text}`);
  return list.split(',').map(phase => phase.trim());
}
