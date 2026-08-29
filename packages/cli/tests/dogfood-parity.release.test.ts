/**
 * Release gate: dogfood parity check.
 *
 * Delegates to runParity() in src/parity.ts. Excluded from `bun run test` so
 * template iteration doesn't block the main suite; run with `bun run test:release`.
 */

import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { formatParityDriftFailure, runParity } from '../src/parity.js';

const templatesDirectory = nodePath.join(import.meta.dirname, '../templates');

describe('dogfood parity', () => {
  it('points parity drift at the canonical install command', () => {
    const message = formatParityDriftFailure(['hook drift']);

    expect(message).toContain('Run `bunx safeword@latest install`');
    expect(message).not.toContain('bunx safeword setup');
  });

  it('should have dogfood files identical to their canonical templates', async () => {
    const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
    const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

    const result = runParity({
      schema: SAFEWORD_SCHEMA,
      mode: 'all',
      rootDirectory: repoRoot,
      templatesDirectory,
    });

    if (result.failures.length > 0) {
      expect.fail(formatParityDriftFailure(result.failures.map(f => f.message)));
    }
  });
});
