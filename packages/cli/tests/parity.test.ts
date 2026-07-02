import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { runParity, syncParityPairs } from '../src/parity.js';

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

  describe('cursor rules (must be thin @reference pointers)', () => {
    function writeRule(templatesDirectory: string, name: string, content: string): void {
      const rulesDirectory = nodePath.join(templatesDirectory, 'cursor', 'rules');
      mkdirSync(rulesDirectory, { recursive: true });
      writeFileSync(nodePath.join(rulesDirectory, name), content);
    }

    it('passes when the rule body is a single @reference after frontmatter', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      writeRule(
        templatesDirectory,
        'safeword-sample.mdc',
        '---\nalwaysApply: false\ndescription: Sample rule.\n---\n\n@.claude/skills/sample/SKILL.md\n',
      );

      const result = runParity({
        schema: { ownedFiles: {}, contracts: {} },
        mode: 'all',
        rootDirectory,
        templatesDirectory,
      });

      expect(result.failures.filter(f => f.kind === 'cursor-rule')).toHaveLength(0);
    });

    it('fails with [CURSOR-RULE] naming the file when a rule has duplicated body content', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      writeRule(
        templatesDirectory,
        'safeword-fat.mdc',
        '---\nalwaysApply: false\ndescription: Fat rule.\n---\n\n# Some Skill\n\nProse that belongs in the skill, not duplicated here.\n',
      );

      const result = runParity({
        schema: { ownedFiles: {}, contracts: {} },
        mode: 'all',
        rootDirectory,
        templatesDirectory,
      });

      const ruleFailures = result.failures.filter(f => f.kind === 'cursor-rule');
      expect(ruleFailures).toHaveLength(1);
      expect(ruleFailures[0]?.message).toContain('[CURSOR-RULE]');
      expect(ruleFailures[0]?.message).toContain('safeword-fat.mdc');
    });

    it('runs in contracts-only mode too (so pre-commit hard-blocks a re-fattened rule)', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      writeRule(
        templatesDirectory,
        'safeword-fat.mdc',
        '---\ndescription: Fat.\n---\n\nDuplicated content line.\n',
      );

      const result = runParity({
        schema: { ownedFiles: {}, contracts: {} },
        mode: 'contracts-only',
        rootDirectory,
        templatesDirectory,
      });

      expect(result.failures.filter(f => f.kind === 'cursor-rule')).toHaveLength(1);
    });

    it('passes a thin rule even with CRLF line endings', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      writeRule(
        templatesDirectory,
        'safeword-crlf.mdc',
        '---\r\nalwaysApply: false\r\ndescription: CRLF rule.\r\n---\r\n\r\n@.claude/skills/sample/SKILL.md\r\n',
      );

      const result = runParity({
        schema: { ownedFiles: {}, contracts: {} },
        mode: 'all',
        rootDirectory,
        templatesDirectory,
      });

      expect(result.failures.filter(f => f.kind === 'cursor-rule')).toHaveLength(0);
    });

    it('ignores non-.mdc files in the rules directory', () => {
      const { rootDirectory, templatesDirectory } = makeFixture();
      writeRule(templatesDirectory, 'README.md', '# not a rule\n\nlots of prose\n');

      const result = runParity({
        schema: { ownedFiles: {}, contracts: {} },
        mode: 'all',
        rootDirectory,
        templatesDirectory,
      });

      expect(result.failures.filter(f => f.kind === 'cursor-rule')).toHaveLength(0);
    });
  });
});

describe('syncParityPairs (--fix, issue #585)', () => {
  it('copies the canonical template over a drifted dogfood mirror', () => {
    const { rootDirectory, templatesDirectory } = makeFixture();
    mkdirSync(nodePath.join(rootDirectory, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(templatesDirectory, 'sample.ts'), 'CANONICAL\n');
    writeFileSync(nodePath.join(rootDirectory, '.safeword/sample.ts'), 'DRIFTED\n');

    const result = syncParityPairs({
      schema: { ownedFiles: { '.safeword/sample.ts': { template: 'sample.ts' } }, contracts: {} },
      mode: 'all',
      rootDirectory,
      templatesDirectory,
    });

    expect(result.synced).toEqual(['.safeword/sample.ts']);
    expect(result.unfixable).toHaveLength(0);
    expect(readFileSync(nodePath.join(rootDirectory, '.safeword/sample.ts'), 'utf8')).toBe(
      'CANONICAL\n',
    );
  });

  it('creates a missing dogfood mirror and its parent directories from the template', () => {
    const { rootDirectory, templatesDirectory } = makeFixture();
    mkdirSync(nodePath.join(templatesDirectory, 'hooks/lib'), { recursive: true });
    writeFileSync(nodePath.join(templatesDirectory, 'hooks/lib/retro.ts'), 'export const x = 1;\n');
    const dest = '.safeword/hooks/lib/retro.ts';

    const result = syncParityPairs({
      schema: { ownedFiles: { [dest]: { template: 'hooks/lib/retro.ts' } }, contracts: {} },
      mode: 'all',
      rootDirectory,
      templatesDirectory,
    });

    expect(result.synced).toEqual([dest]);
    expect(existsSync(nodePath.join(rootDirectory, dest))).toBe(true);
    expect(readFileSync(nodePath.join(rootDirectory, dest), 'utf8')).toBe('export const x = 1;\n');
  });

  it('leaves a byte-identical pair untouched', () => {
    const { rootDirectory, templatesDirectory } = makeFixture();
    mkdirSync(nodePath.join(rootDirectory, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(templatesDirectory, 'sample.ts'), 'same\n');
    writeFileSync(nodePath.join(rootDirectory, '.safeword/sample.ts'), 'same\n');

    const result = syncParityPairs({
      schema: { ownedFiles: { '.safeword/sample.ts': { template: 'sample.ts' } }, contracts: {} },
      mode: 'all',
      rootDirectory,
      templatesDirectory,
    });

    expect(result.synced).toHaveLength(0);
    expect(result.unfixable).toHaveLength(0);
  });

  it('reports a pair as unfixable when the template is missing (nothing to copy from)', () => {
    const { rootDirectory, templatesDirectory } = makeFixture();
    mkdirSync(nodePath.join(rootDirectory, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(rootDirectory, '.safeword/orphan.ts'), 'dogfood only\n');

    const result = syncParityPairs({
      schema: { ownedFiles: { '.safeword/orphan.ts': { template: 'orphan.ts' } }, contracts: {} },
      mode: 'all',
      rootDirectory,
      templatesDirectory,
    });

    expect(result.synced).toHaveLength(0);
    expect(result.unfixable).toHaveLength(1);
    expect(result.unfixable[0]?.message).toContain('template missing');
    expect(readFileSync(nodePath.join(rootDirectory, '.safeword/orphan.ts'), 'utf8')).toBe(
      'dogfood only\n',
    );
  });
});
