import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { runParity } from '../src/parity.js';

function makeFixture(): { rootDirectory: string; templatesDirectory: string } {
  const base = mkdtempSync(nodePath.join(tmpdir(), 'parity-'));
  const rootDirectory = nodePath.join(base, 'root');
  const templatesDirectory = nodePath.join(base, 'templates');
  mkdirSync(rootDirectory, { recursive: true });
  mkdirSync(templatesDirectory, { recursive: true });
  return { rootDirectory, templatesDirectory };
}

// A fresh empty templates dir — for tests that don't exercise template parity
// (e.g. contract-only tests), so the orphan-template scan finds nothing.
function emptyTemplatesDirectory(): string {
  return mkdtempSync(nodePath.join(tmpdir(), 'parity-tpl-'));
}

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
        templatesDirectory: emptyTemplatesDirectory(),
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
        templatesDirectory: emptyTemplatesDirectory(),
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
        templatesDirectory: emptyTemplatesDirectory(),
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
        templatesDirectory: emptyTemplatesDirectory(),
      });

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.kind).toBe('contract');
      expect(result.failures[0]?.message).toContain(target);
      expect(result.failures[0]?.message.toLowerCase()).toMatch(/missing|not found|does not exist/);
    });
  });

  describe('pairs', () => {
    it('passes when pair files are byte-identical', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      mkdirSync(nodePath.join(rootDirectory, '.safeword'), { recursive: true });
      writeFileSync(nodePath.join(templatesDirectory, 'sample.ts'), 'identical\n');
      writeFileSync(nodePath.join(rootDirectory, '.safeword/sample.ts'), 'identical\n');

      const result = runParity({
        schema: {
          ownedFiles: { '.safeword/sample.ts': { template: 'sample.ts' } },
          contracts: {},
        },
        mode: 'all',
        rootDirectory,
        templatesDirectory,
      });

      expect(result.failures).toHaveLength(0);
      expect(result.passedCount).toBe(1);
    });

    it('fails with [PAIR] naming both paths when files differ in any byte', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      mkdirSync(nodePath.join(rootDirectory, '.safeword'), { recursive: true });
      writeFileSync(nodePath.join(templatesDirectory, 'sample.ts'), 'A\n');
      writeFileSync(nodePath.join(rootDirectory, '.safeword/sample.ts'), 'B\n');

      const result = runParity({
        schema: {
          ownedFiles: { '.safeword/sample.ts': { template: 'sample.ts' } },
          contracts: {},
        },
        mode: 'all',
        rootDirectory,
        templatesDirectory,
      });

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.kind).toBe('pair');
      expect(result.failures[0]?.message).toContain('[PAIR]');
      expect(result.failures[0]?.message).toContain('.safeword/sample.ts');
      expect(result.failures[0]?.message).toContain('sample.ts');
    });

    it('fails identifying the missing path when one side of a pair is missing', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      writeFileSync(nodePath.join(templatesDirectory, 'sample.ts'), 'only template\n');
      // dogfood file intentionally not created

      const result = runParity({
        schema: {
          ownedFiles: { '.safeword/sample.ts': { template: 'sample.ts' } },
          contracts: {},
        },
        mode: 'all',
        rootDirectory,
        templatesDirectory,
      });

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.kind).toBe('pair');
      expect(result.failures[0]?.message).toContain('.safeword/sample.ts');
      expect(result.failures[0]?.message.toLowerCase()).toMatch(/missing|not found|does not exist/);
    });

    it('fails on whitespace-only differences (strict byte comparison)', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      mkdirSync(nodePath.join(rootDirectory, '.safeword'), { recursive: true });
      writeFileSync(nodePath.join(templatesDirectory, 'sample.ts'), 'foo\n');
      writeFileSync(nodePath.join(rootDirectory, '.safeword/sample.ts'), 'foo\n\n'); // extra newline

      const result = runParity({
        schema: {
          ownedFiles: { '.safeword/sample.ts': { template: 'sample.ts' } },
          contracts: {},
        },
        mode: 'all',
        rootDirectory,
        templatesDirectory,
      });

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.kind).toBe('pair');
    });
  });

  describe('orphan templates (template → schema)', () => {
    it('fails with [TEMPLATE] when a templates/ file has no schema entry', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      writeFileSync(nodePath.join(templatesDirectory, 'unregistered.md'), 'orphan\n');

      const result = runParity({
        schema: { ownedFiles: {}, contracts: {} },
        mode: 'all',
        rootDirectory,
        templatesDirectory,
      });

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.kind).toBe('orphan-template');
      expect(result.failures[0]?.message).toContain('[TEMPLATE]');
      expect(result.failures[0]?.message).toContain('unregistered.md');
    });

    it('passes when the template is registered via ownedFiles', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      mkdirSync(nodePath.join(rootDirectory, '.safeword'), { recursive: true });
      writeFileSync(nodePath.join(templatesDirectory, 'reg.md'), 'x\n');
      writeFileSync(nodePath.join(rootDirectory, '.safeword/reg.md'), 'x\n');

      const result = runParity({
        schema: { ownedFiles: { '.safeword/reg.md': { template: 'reg.md' } }, contracts: {} },
        mode: 'all',
        rootDirectory,
        templatesDirectory,
      });

      expect(result.failures).toHaveLength(0);
    });

    it('passes when the template is registered via managedFiles', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      writeFileSync(nodePath.join(templatesDirectory, 'personas-template.md'), 'x\n');

      const result = runParity({
        schema: {
          ownedFiles: {},
          managedFiles: { '.safeword-project/personas.md': { template: 'personas-template.md' } },
          contracts: {},
        },
        mode: 'all',
        rootDirectory,
        templatesDirectory,
      });

      expect(result.failures).toHaveLength(0);
    });

    it('skips files under _-prefixed dirs (shared includes, not installable)', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      mkdirSync(nodePath.join(templatesDirectory, '_shared'), { recursive: true });
      writeFileSync(nodePath.join(templatesDirectory, '_shared/include.md'), 'x\n');

      const result = runParity({
        schema: { ownedFiles: {}, contracts: {} },
        mode: 'all',
        rootDirectory,
        templatesDirectory,
      });

      expect(result.failures).toHaveLength(0);
    });

    it('runs in contracts-only mode too (so pre-commit hard-blocks it)', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      writeFileSync(nodePath.join(templatesDirectory, 'unregistered.md'), 'orphan\n');

      const result = runParity({
        schema: { ownedFiles: {}, contracts: {} },
        mode: 'contracts-only',
        rootDirectory,
        templatesDirectory,
      });

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.kind).toBe('orphan-template');
    });
  });
});
