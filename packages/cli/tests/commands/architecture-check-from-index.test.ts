/**
 * `safeword project architecture --check --from-index` is a read-only index
 * check: it answers whether generating from the staged Git index would change
 * anything, and it must produce no effects at all
 * (predictable-safeword-cli.TBU1.R2).
 *
 * The handler used to dispatch on `--from-index` before consulting `--check`,
 * so `--check --from-index` ran the staged-tree generation mode and rewrote
 * architecture documents, and `--check --from-index --stage-output`
 * additionally `git add`ed them. A result-envelope assertion cannot catch that,
 * so every scenario here fingerprints the document bytes AND the Git index and
 * asserts both are byte-identical across the run.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { selfHeal } from '../../src/utils/architecture-document.js';
import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  runCli,
} from '../helpers.js';

const context: { directory: string } = { directory: '' };

const DOC_RELATIVE = '.project/architecture.generated.md';

function git(directory: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
}

function commitAll(directory: string, message: string): void {
  git(directory, 'add', '-A');
  git(directory, 'commit', '-m', message);
}

/**
 * Every observable effect surface the check must leave alone: the exact index
 * entries (mode + blob sha + stage per path), the worktree/index divergence
 * git reports, and the generated document's own bytes.
 */
interface EffectFingerprint {
  readonly index: string;
  readonly status: string;
  readonly document: string | undefined;
}

function fingerprintEffects(directory: string): EffectFingerprint {
  const documentPath = nodePath.join(directory, DOC_RELATIVE);
  return {
    index: git(directory, 'ls-files', '--stage'),
    status: git(directory, 'status', '--porcelain'),
    document: existsSync(documentPath) ? readFileSync(documentPath, 'utf8') : undefined,
  };
}

function addWorktreePackage(directory: string, name: string): string {
  const relativePath = nodePath.join('src', name, 'index.ts');
  mkdirSync(nodePath.join(directory, 'src', name), { recursive: true });
  writeFileSync(nodePath.join(directory, relativePath), `export const ${name} = true;\n`);
  return relativePath;
}

beforeEach(() => {
  context.directory = createTemporaryDirectory();
  initGitRepo(context.directory);
  addWorktreePackage(context.directory, 'auth');
  writeFileSync(
    nodePath.join(context.directory, 'package.json'),
    JSON.stringify({ name: 'fixture' }),
  );
  commitAll(context.directory, 'initial fixture');
  selfHeal(context.directory);
  commitAll(context.directory, 'record initial architecture');
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

describe('project architecture --check --from-index', () => {
  it.each([
    { name: '--check --from-index', flags: ['--check', '--from-index'] },
    { name: '--check --staged (deprecated)', flags: ['--check', '--staged'] },
  ])(
    'reports staged drift without writing documents or touching the index: $name',
    async ({ flags }) => {
      const staged = addWorktreePackage(context.directory, 'billing');
      git(context.directory, 'add', '--', staged);
      const before = fingerprintEffects(context.directory);

      const result = await runCli(['project', 'architecture', ...flags, '--json'], {
        cwd: context.directory,
      });

      // Effects first: this is the assertion the dispatch-ordering bug tripped.
      expect(fingerprintEffects(context.directory)).toStrictEqual(before);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'action_required',
        findings: expect.arrayContaining([expect.objectContaining({ code: 'ARCHITECTURE_DRIFT' })]),
      });
    },
  );

  it('reads the index rather than the worktree, so unstaged drift reports fresh', async () => {
    // Present only in the worktree: the index is still fresh, the worktree is not.
    addWorktreePackage(context.directory, 'billing');
    const before = fingerprintEffects(context.directory);

    const fromIndex = await runCli(
      ['project', 'architecture', '--check', '--from-index', '--json'],
      { cwd: context.directory },
    );
    const fromWorktree = await runCli(['project', 'architecture', '--check', '--json'], {
      cwd: context.directory,
    });

    expect(fingerprintEffects(context.directory)).toStrictEqual(before);
    expect(JSON.parse(fromIndex.stdout)).toMatchObject({ state: 'healthy' });
    expect(fromIndex.exitCode).toBe(0);
    expect(JSON.parse(fromWorktree.stdout)).toMatchObject({ state: 'action_required' });
  });

  it.each([
    {
      name: '--check --from-index --stage-output',
      flags: ['--check', '--from-index', '--stage-output'],
    },
    { name: '--check --stage-output', flags: ['--check', '--stage-output'] },
    { name: '--check --stage (deprecated)', flags: ['--check', '--stage'] },
  ])('refuses to combine a read-only check with staged output: $name', async ({ flags }) => {
    const staged = addWorktreePackage(context.directory, 'billing');
    git(context.directory, 'add', '--', staged);
    const before = fingerprintEffects(context.directory);

    const result = await runCli(['project', 'architecture', ...flags, '--json'], {
      cwd: context.directory,
    });

    expect(fingerprintEffects(context.directory)).toStrictEqual(before);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [{ code: 'CLI_ARGUMENT_INVALID' }],
    });
  });

  it('reports the failure instead of a clean bill when the index cannot be read', async () => {
    const staged = addWorktreePackage(context.directory, 'billing');
    git(context.directory, 'add', '--', staged);
    const before = fingerprintEffects(context.directory);

    // An unusable git makes the index unreadable. A read-only check must not
    // silently report "current" when it never managed to look.
    const result = await runCli(['project', 'architecture', '--check', '--from-index', '--json'], {
      cwd: context.directory,
      env: { PATH: '' },
    });

    expect(fingerprintEffects(context.directory)).toStrictEqual(before);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [{ code: 'ARCHITECTURE_INDEX_CHECK_FAILED' }],
    });
  });

  it('falls back to a read-only worktree check outside a Git worktree', async () => {
    const directory = createTemporaryDirectory();
    try {
      addWorktreePackage(directory, 'auth');
      writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'fixture' }));

      const result = await runCli(
        ['project', 'architecture', '--check', '--from-index', '--json'],
        {
          cwd: directory,
        },
      );

      // The staging path generates from the worktree here; the check must not.
      expect(existsSync(nodePath.join(directory, DOC_RELATIVE))).toBe(false);
      const envelope = JSON.parse(result.stdout) as {
        state: string;
        findings: { message: string }[];
      };
      expect(envelope.state).toBe('action_required');
      expect(envelope.findings.map(finding => finding.message).join('\n')).toContain(
        'No Git worktree found',
      );
    } finally {
      removeTemporaryDirectory(directory);
    }
  });

  it('leaves a missing architecture document uncreated when the index is stale', async () => {
    git(context.directory, 'rm', '--quiet', '--', DOC_RELATIVE);
    commitAll(context.directory, 'drop the architecture document');
    const before = fingerprintEffects(context.directory);
    expect(before.document).toBeUndefined();

    const result = await runCli(['project', 'architecture', '--check', '--from-index', '--json'], {
      cwd: context.directory,
    });

    expect(fingerprintEffects(context.directory)).toStrictEqual(before);
    expect(existsSync(nodePath.join(context.directory, DOC_RELATIVE))).toBe(false);
    expect(JSON.parse(result.stdout)).toMatchObject({ state: 'action_required' });
  });
});
