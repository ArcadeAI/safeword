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

    it('fails when one required string is missing, naming the missing string and target file', () => {
      const rootDirectory = mkdtempSync(nodePath.join(tmpdir(), 'parity-'));
      const target = 'sample.ts';
      writeFileSync(nodePath.join(rootDirectory, target), 'has FOO but no marker\n');

      const result = runParity({
        schema: {
          ownedFiles: {},
          contracts: { [target]: { requires: ['FOO', 'MISSING_TOKEN'] } },
        },
        mode: 'all',
        rootDirectory,
        templatesDirectory: rootDirectory,
      });

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.kind).toBe('contract');
      expect(result.failures[0]?.message).toContain('[CONTRACT]');
      expect(result.failures[0]?.message).toContain('MISSING_TOKEN');
      expect(result.failures[0]?.message).toContain(target);
      expect(result.passedCount).toBe(0);
    });

    it('reports all missing strings in one failure when multiple are missing', () => {
      const rootDirectory = mkdtempSync(nodePath.join(tmpdir(), 'parity-'));
      const target = 'sample.ts';
      writeFileSync(nodePath.join(rootDirectory, target), 'only_FOO_here\n');

      const result = runParity({
        schema: {
          ownedFiles: {},
          contracts: { [target]: { requires: ['FOO', 'BAR', 'BAZ'] } },
        },
        mode: 'all',
        rootDirectory,
        templatesDirectory: rootDirectory,
      });

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.message).toContain('BAR');
      expect(result.failures[0]?.message).toContain('BAZ');
      expect(result.failures[0]?.message).not.toContain('FOO,'); // FOO was present, not in missing list
    });

    it('fails identifying the missing path when the target file is missing', () => {
      const rootDirectory = mkdtempSync(nodePath.join(tmpdir(), 'parity-'));
      const target = 'does-not-exist.ts';

      const result = runParity({
        schema: {
          ownedFiles: {},
          contracts: { [target]: { requires: ['FOO'] } },
        },
        mode: 'all',
        rootDirectory,
        templatesDirectory: rootDirectory,
      });

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.kind).toBe('contract');
      expect(result.failures[0]?.message).toContain(target);
      expect(result.failures[0]?.message.toLowerCase()).toMatch(/missing|not found|does not exist/);
    });
  });
});
