import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { runParity } from '../src/parity.js';

describe('runParity', () => {
  describe('contracts', () => {
    it('passes when all required strings are present in the target file', () => {
      const rootDirectory = mkdtempSync(nodePath.join(tmpdir(), 'parity-'));
      const target = 'sample.ts';
      writeFileSync(
        nodePath.join(rootDirectory, target),
        'export const FOO = "BAR";\n// CONFIDENT BLOCKED Tried: Need:\n',
      );

      const result = runParity({
        schema: {
          ownedFiles: {},
          contracts: {
            [target]: { requires: ['FOO', 'CONFIDENT', 'BLOCKED', 'Tried:', 'Need:'] },
          },
        },
        mode: 'all',
        rootDirectory,
        templatesDirectory: rootDirectory,
      });

      expect(result.failures).toHaveLength(0);
      expect(result.passedCount).toBe(1);
    });
  });
});
