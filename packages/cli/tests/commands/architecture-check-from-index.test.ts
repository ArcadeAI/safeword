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
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

  it('refuses to answer from the worktree when there is no Git index', async () => {
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

      // The generation modes degrade to the worktree here. A check must not:
      // the worktree answers a different question than the one that was asked.
      expect(existsSync(nodePath.join(directory, DOC_RELATIVE))).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'failed',
        errors: [{ code: 'ARCHITECTURE_INDEX_CHECK_FAILED' }],
      });
    } finally {
      removeTemporaryDirectory(directory);
    }
  });

  it('fails instead of reporting the worktree when the repository is unreadable', async () => {
    // The false green this guards: `git rev-parse` fails identically for an
    // unreadable repository and a plain non-repository, so a worktree fallback
    // would report `healthy` on a stale index whenever Git discovery broke.
    const staged = addWorktreePackage(context.directory, 'billing');
    git(context.directory, 'add', '--', staged);
    // Refresh the worktree document so the worktree is fresh while the index is
    // stale — the exact state where a worktree fallback answers "healthy".
    selfHeal(context.directory);
    const documentPath = nodePath.join(context.directory, DOC_RELATIVE);
    const documentBefore = readFileSync(documentPath, 'utf8');
    const gitDirectory = nodePath.join(context.directory, '.git');

    chmodSync(gitDirectory, 0o000);
    let result;
    try {
      result = await runCli(['project', 'architecture', '--check', '--from-index', '--json'], {
        cwd: context.directory,
      });
    } finally {
      chmodSync(gitDirectory, 0o755);
    }

    expect(readFileSync(documentPath, 'utf8')).toBe(documentBefore);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [{ code: 'ARCHITECTURE_INDEX_CHECK_FAILED' }],
    });
  });

  it('reports a stale indexed document even when the worktree copy is foreign', async () => {
    // The false green this guards: the staging path skips a destination whose
    // worktree file is not Safeword-owned, so a verdict derived from that plan
    // would report `healthy` while the *indexed* document is stale. An
    // uncommitted local file must not be able to silence the freshness gate.
    const staged = addWorktreePackage(context.directory, 'billing');
    git(context.directory, 'add', '--', staged);
    const documentPath = nodePath.join(context.directory, DOC_RELATIVE);
    const foreign = '# Hand-written architecture\n\nNo safeword generator marker.\n';
    writeFileSync(documentPath, foreign);
    const before = fingerprintEffects(context.directory);

    const result = await runCli(['project', 'architecture', '--check', '--from-index', '--json'], {
      cwd: context.directory,
    });

    expect(fingerprintEffects(context.directory)).toStrictEqual(before);
    expect(readFileSync(documentPath, 'utf8')).toBe(foreign);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      findings: expect.arrayContaining([expect.objectContaining({ code: 'ARCHITECTURE_DRIFT' })]),
    });
  });

  it('treats a foreign document in the index as none of its business', async () => {
    // Ownership is still honored — but decided from the indexed document, not
    // the worktree one. A hand-written doc committed to the repo is not drift.
    const documentPath = nodePath.join(context.directory, DOC_RELATIVE);
    writeFileSync(documentPath, '# Hand-written architecture\n\nNo generator marker.\n');
    commitAll(context.directory, 'hand-write the architecture document');
    const staged = addWorktreePackage(context.directory, 'billing');
    git(context.directory, 'add', '--', staged);
    const before = fingerprintEffects(context.directory);

    const result = await runCli(['project', 'architecture', '--check', '--from-index', '--json'], {
      cwd: context.directory,
    });

    expect(fingerprintEffects(context.directory)).toStrictEqual(before);
    expect(JSON.parse(result.stdout)).toMatchObject({ state: 'healthy' });
    expect(result.exitCode).toBe(0);
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
