import { describe, expect, it } from 'vitest';

import {
  SAFEWORD_SCHEMA,
  type SafewordSchema,
  schemaForProjectSurfaces,
  schemaForSharedAgentRuntime,
} from '../src/schema.js';

const ARRAY_COLLECTIONS = [
  'ownedDirs',
  'sharedDirs',
  'preservedDirs',
  'deprecatedFiles',
  'deprecatedDirs',
] as const;

const RECORD_COLLECTIONS = [
  'ownedFiles',
  'managedFiles',
  'jsonMerges',
  'textPatches',
  'legacyTextPatches',
  'contracts',
] as const;

function schemaWithSentinel(path: string): SafewordSchema {
  return {
    ...SAFEWORD_SCHEMA,
    ...Object.fromEntries(
      ARRAY_COLLECTIONS.map(collection => [collection, [...SAFEWORD_SCHEMA[collection], path]]),
    ),
    ...Object.fromEntries(
      RECORD_COLLECTIONS.map(collection => [
        collection,
        { ...SAFEWORD_SCHEMA[collection], [path]: undefined },
      ]),
    ),
  };
}

function expectPathRemovedFromEveryCollection(schema: SafewordSchema, path: string): void {
  for (const collection of ARRAY_COLLECTIONS) expect(schema[collection]).not.toContain(path);
  for (const collection of RECORD_COLLECTIONS)
    expect(Object.hasOwn(schema[collection], path)).toBe(false);
}

describe('schema path projections', () => {
  it('removes an unselected Cursor path from every path-bearing collection', () => {
    const path = '.cursor/characterization';

    const projected = schemaForProjectSurfaces(schemaWithSentinel(path), ['core']);

    expectPathRemovedFromEveryCollection(projected, path);
  });

  it('removes an unneeded shared-runtime path from every path-bearing collection', () => {
    const path = '.safeword/hooks/characterization.ts';

    const projected = schemaForSharedAgentRuntime(schemaWithSentinel(path), false);

    expectPathRemovedFromEveryCollection(projected, path);
  });
});
