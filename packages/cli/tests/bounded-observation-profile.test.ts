import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const root = nodePath.resolve(import.meta.dirname, '../../..');
const profilePath = nodePath.join(root, 'packages/cli/src/bounded-observation/profile.json');

describe('shipped bounded-observation profile metadata', () => {
  afterEach(() => {
    vi.doUnmock('../src/bounded-observation/profile.json');
    vi.resetModules();
  });

  it.each([
    { field: 'schema_version', value: 2 },
    { field: 'purpose', value: 'foreign-purpose:v1' },
    { field: 'ticket', value: 'OTHER' },
  ])('rejects unsupported $field before candidate execution', async ({ field, value }) => {
    const profile = JSON.parse(readFileSync(profilePath, 'utf8')) as Record<string, unknown>;
    profile[field] = value;
    vi.resetModules();
    vi.doMock('../src/bounded-observation/profile.json', () => ({ default: profile }));
    const { validateCandidateContract } = await import('../src/bounded-observation/contract.js');
    expect(() => {
      validateCandidateContract(root);
    }).toThrow(`Unsupported shipped profile ${field}`);
  });
});
