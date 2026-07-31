/**
 * Integration tests for `safeword architecture --stage` — the commit-time
 * auto-fix-and-stage surface (ticket FPV0E4, Slice 2, TB1/TB3.AC1). Runs the
 * built CLI inside a real temp git repo and asserts the git index, because the
 * contract IS the side effect: regenerate a stale doc and `git add` it, never
 * block, never touch a doc that needs no change or that safeword does not own.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  linkSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readDocumentFingerprint,
  selfHeal,
  selfHealProject,
} from '../../src/utils/architecture-document.js';
import { shapeFingerprint } from '../../src/utils/architecture-fingerprint.js';
import {
  resolveGeneratedArchitecturePath,
  resolveNamespaceRoot,
} from '../../src/utils/configured-paths.js';
import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  runCli,
} from '../helpers.js';

const context: { directory: string } = { directory: '' };

const DOC_RELATIVE = '.project/architecture.generated.md';

function stagedFiles(directory: string): string[] {
  const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: directory,
    encoding: 'utf8',
  });
  return out.split('\n').filter(line => line.length > 0);
}

function writeEnforcementConfig(directory: string, enabled: boolean): void {
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword', 'config.json'),
    JSON.stringify({ architectureDocEnforcement: enabled }),
  );
}

function git(directory: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
}

function commitAll(directory: string, message: string): void {
  git(directory, 'add', '-A');
  git(directory, 'commit', '-m', message);
}

beforeEach(() => {
  context.directory = createTemporaryDirectory();
  initGitRepo(context.directory);
  mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });
  writeFileSync(
    nodePath.join(context.directory, 'src', 'auth', 'index.ts'),
    'export const auth = true;\n',
  );
  writeFileSync(
    nodePath.join(context.directory, 'package.json'),
    JSON.stringify({ name: 'fixture' }),
  );
  commitAll(context.directory, 'initial fixture');
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

describe('architecture --stage — commit-time auto-fix (FPV0E4 Slice 2)', () => {
  it('creates and stages a doc carrying the current fingerprint when none exists', async () => {
    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(stagedFiles(context.directory)).toContain(DOC_RELATIVE);
    const content = execFileSync('git', ['show', `:${DOC_RELATIVE}`], {
      cwd: context.directory,
      encoding: 'utf8',
    });
    expect(readDocumentFingerprint(content)).toBe(shapeFingerprint(context.directory));
  });

  it('regenerates and stages a stale doc', async () => {
    selfHeal(context.directory);
    commitAll(context.directory, 'record initial architecture');
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    git(context.directory, 'add', '--', 'src/billing/index.ts');

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(stagedFiles(context.directory)).toContain(DOC_RELATIVE);
    const content = execFileSync('git', ['show', `:${DOC_RELATIVE}`], {
      cwd: context.directory,
      encoding: 'utf8',
    });
    expect(content).toContain('billing');
  });

  it('lands the regenerated doc in the actual commit a plain `git commit` makes', async () => {
    // End-to-end: stage like the hook, then commit like the agent, and inspect
    // HEAD — proves "staged in THAT commit" at the commit level, not just the index.
    selfHeal(context.directory);
    commitAll(context.directory, 'record initial architecture');
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    git(context.directory, 'add', '--', 'src/billing/index.ts');

    const stage = await runCli(['architecture', '--stage'], { cwd: context.directory });
    expect(stage.exitCode).toBe(0);
    execFileSync('git', ['commit', '-m', 'agent change'], { cwd: context.directory });

    const committed = execFileSync('git', ['show', '--name-only', '--format=', 'HEAD'], {
      cwd: context.directory,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(line => line.length > 0);
    expect(committed).toContain(DOC_RELATIVE);
    const headDocument = execFileSync('git', ['show', `HEAD:${DOC_RELATIVE}`], {
      cwd: context.directory,
      encoding: 'utf8',
    });
    expect(headDocument).toContain('billing');

    const cleanCheckout = nodePath.join(context.directory, 'clean-checkout');
    git(context.directory, 'clone', '--quiet', '--no-local', context.directory, cleanCheckout);
    const check = await runCli(['architecture', '--check'], { cwd: cleanCheckout });
    expect(check.exitCode).toBe(0);
  });

  it('does not stage a doc that already matches the current shape', async () => {
    selfHeal(context.directory);
    commitAll(context.directory, 'record current architecture');

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
  });

  it('never touches or stages a foreign hand-written doc', async () => {
    mkdirSync(resolveNamespaceRoot(context.directory), { recursive: true });
    const foreign = '# Our Architecture\n\nHand-written, no marker.\n';
    writeFileSync(resolveGeneratedArchitecturePath(context.directory), foreign);
    commitAll(context.directory, 'record hand-written architecture');

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
    expect(execFileSync('cat', [DOC_RELATIVE], { cwd: context.directory, encoding: 'utf8' })).toBe(
      foreign,
    );
  });

  it.each([
    ['normal staging', {}],
    ['hook keep-materialized staging', { SAFEWORD_ARCHITECTURE_KEEP_MATERIALIZED: '1' }],
  ])('preserves an untracked foreign doc during %s', async (_label, env) => {
    mkdirSync(resolveNamespaceRoot(context.directory), { recursive: true });
    const foreign = '# Our Architecture\n\nHand-written and untracked.\n';
    const documentPath = resolveGeneratedArchitecturePath(context.directory);
    writeFileSync(documentPath, foreign);
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    git(context.directory, 'add', '--', 'src/billing/index.ts');

    const result = await runCli(['architecture', '--stage'], {
      cwd: context.directory,
      env,
    });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('not owned by Safeword');
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'Architecture docs left unchanged (1 document is not Safeword-owned).',
    );
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('Architecture docs need no change.');
    expect(readFileSync(documentPath, 'utf8')).toBe(foreign);
    expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
  });

  it('preserves an unrelated staged change while staging the regenerated doc', async () => {
    selfHeal(context.directory);
    commitAll(context.directory, 'record initial architecture');
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    writeFileSync(nodePath.join(context.directory, 'NOTES.md'), 'unrelated work\n');
    git(context.directory, 'add', '--', 'src/billing/index.ts', 'NOTES.md');

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    const staged = stagedFiles(context.directory);
    expect(staged).toContain('NOTES.md');
    expect(staged).toContain(DOC_RELATIVE);
  });

  it('does not regenerate or stage a stale doc when enforcement is opted out', async () => {
    selfHeal(context.directory);
    const before = execFileSync('cat', [DOC_RELATIVE], {
      cwd: context.directory,
      encoding: 'utf8',
    });
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    writeEnforcementConfig(context.directory, false);
    git(context.directory, 'add', '--', 'src/billing/index.ts', '.safeword/config.json');

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
    expect(execFileSync('cat', [DOC_RELATIVE], { cwd: context.directory, encoding: 'utf8' })).toBe(
      before,
    );
  });

  it('does not require the narrative to duplicate the generated package inventory', async () => {
    // Decision records remain silent about packages with no architectural decision.
    // The generated root index owns package coverage, regardless of enforcement.
    execFileSync('rm', ['-rf', 'src'], { cwd: context.directory });
    writeFileSync(
      nodePath.join(context.directory, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    );
    for (const pkg of ['web', 'billing']) {
      mkdirSync(nodePath.join(context.directory, 'packages', pkg, 'src'), { recursive: true });
      writeFileSync(
        nodePath.join(context.directory, 'packages', pkg, 'package.json'),
        JSON.stringify({ name: pkg }),
      );
      writeFileSync(
        nodePath.join(context.directory, 'packages', pkg, 'src', 'index.ts'),
        'export {};\n',
      );
    }
    // The decision narrative mentions only web; billing has no decision to record.
    writeFileSync(
      nodePath.join(context.directory, 'ARCHITECTURE.md'),
      '# Architecture\n\nThe web package serves the UI.\n',
    );
    // Pre-generate the root index; the opt-out branch skips the heal.
    selfHealProject(context.directory);
    writeEnforcementConfig(context.directory, false);
    git(context.directory, 'add', '-A');

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).not.toContain('does not mention');
    expect(output).not.toContain('billing');
  });

  it('exits zero even with no modules and no doc (noop never blocks)', async () => {
    git(context.directory, 'rm', '-r', 'src');

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(existsSync(resolveGeneratedArchitecturePath(context.directory))).toBe(false);
  });

  it('excludes untracked descendant shape that leaves the rendered modules unchanged', async () => {
    const stagedTreeFingerprint = shapeFingerprint(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'auth', 'editor'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'auth', 'editor', 'schema.sql'),
      'CREATE TABLE drafts (id integer);\n',
    );
    expect(shapeFingerprint(context.directory)).not.toBe(stagedTreeFingerprint);

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('src/auth/editor/schema.sql');
    const stagedDocument = git(context.directory, 'show', `:${DOC_RELATIVE}`);
    expect(readDocumentFingerprint(stagedDocument)).toBe(stagedTreeFingerprint);
    expect(stagedDocument.match(/^### /gm)).toHaveLength(1);
    expect(stagedDocument).toContain('### auth');
  });

  it('preserves unstaged human prose while healing from the staged source shape', async () => {
    selfHeal(context.directory);
    commitAll(context.directory, 'record current architecture');
    const documentPath = resolveGeneratedArchitecturePath(context.directory);
    writeFileSync(
      documentPath,
      readFileSync(documentPath, 'utf8').replace(
        'No description yet — awaiting prose.',
        'IMPORTANT HUMAN PROSE.',
      ),
    );
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    git(context.directory, 'add', '--', 'src/billing/index.ts');

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(readFileSync(documentPath, 'utf8')).toContain('IMPORTANT HUMAN PROSE.');
    expect(git(context.directory, 'show', `:${DOC_RELATIVE}`)).toContain('IMPORTANT HUMAN PROSE.');
  });

  it('stages deterministic shape without destroying a worktree-only module or its prose', async () => {
    selfHeal(context.directory);
    commitAll(context.directory, 'record current architecture');
    const documentPath = resolveGeneratedArchitecturePath(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'drafts'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'drafts', 'index.ts'),
      'export const drafts = true;\n',
    );
    await runCli(['architecture'], { cwd: context.directory });
    writeFileSync(
      documentPath,
      readFileSync(documentPath, 'utf8').replaceAll(
        'No description yet — awaiting prose.',
        'IMPORTANT WORKTREE PROSE.',
      ),
    );
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    git(context.directory, 'add', '--', 'src/billing/index.ts');

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    const stagedDocument = git(context.directory, 'show', `:${DOC_RELATIVE}`);
    expect(stagedDocument).toContain('### billing');
    expect(stagedDocument).not.toContain('### drafts');
    const worktreeDocument = readFileSync(documentPath, 'utf8');
    expect(worktreeDocument).toContain('### drafts');
    expect(worktreeDocument).toContain('IMPORTANT WORKTREE PROSE.');
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'Preserved unstaged worktree architecture edits',
    );
  });

  it('keeps a durable recovery copy when restoring worktree-only edits fails', async () => {
    selfHeal(context.directory);
    commitAll(context.directory, 'record current architecture');
    const documentPath = resolveGeneratedArchitecturePath(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'drafts'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'drafts', 'index.ts'),
      'export const drafts = true;\n',
    );
    await runCli(['architecture'], { cwd: context.directory });
    writeFileSync(
      documentPath,
      readFileSync(documentPath, 'utf8').replaceAll(
        'No description yet — awaiting prose.',
        'RECOVERABLE WORKTREE PROSE.',
      ),
    );
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    git(context.directory, 'add', '--', 'src/billing/index.ts');

    const filterPath = nodePath.join(context.directory, '.git', 'lock-architecture-filter.sh');
    writeFileSync(
      filterPath,
      '#!/bin/sh\nchmod a-w "$SAFEWORD_TEST_ARCHITECTURE_DIRECTORY"\ncat\n',
    );
    chmodSync(filterPath, 0o755);
    git(context.directory, 'config', 'filter.architecture-lock.clean', filterPath);
    writeFileSync(
      nodePath.join(context.directory, '.gitattributes'),
      `${DOC_RELATIVE} filter=architecture-lock\n`,
    );
    git(context.directory, 'add', '--', '.gitattributes');

    let result;
    try {
      result = await runCli(['architecture', '--stage'], {
        cwd: context.directory,
        env: {
          SAFEWORD_TEST_ARCHITECTURE_DIRECTORY: nodePath.dirname(documentPath),
        },
      });
    } finally {
      chmodSync(nodePath.dirname(documentPath), 0o755);
    }
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.exitCode).toBe(0);
    expect(output).toContain('was staged but unstaged worktree edits could not be restored');
    expect(output).not.toContain('nothing was auto-staged');
    const recoveryPath = /Recovery copy: (.+?)\. Cause:/.exec(output)?.[1];
    assert.ok(recoveryPath !== undefined, 'expected the failure output to name a recovery copy');
    try {
      const recoveryContent = readFileSync(recoveryPath, 'utf8');
      expect(recoveryContent).toContain('### drafts');
      expect(recoveryContent).toContain('RECOVERABLE WORKTREE PROSE.');
      const stagedDocument = git(context.directory, 'show', `:${DOC_RELATIVE}`);
      expect(stagedDocument).toContain('### billing');
      expect(stagedDocument).not.toContain('### drafts');
    } finally {
      rmSync(nodePath.dirname(recoveryPath), { recursive: true, force: true });
    }
  });

  it('honors an unstaged worktree enforcement opt-out immediately', async () => {
    selfHeal(context.directory);
    commitAll(context.directory, 'record current architecture');
    const documentPath = resolveGeneratedArchitecturePath(context.directory);
    const before = readFileSync(documentPath, 'utf8');
    writeEnforcementConfig(context.directory, false);
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    git(context.directory, 'add', '--', 'src/billing/index.ts');

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('enforcement is opted out');
    expect(readFileSync(documentPath, 'utf8')).toBe(before);
    expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
  });

  it('honors the worktree opt-out before inspecting unsupported gitlinks', async () => {
    selfHeal(context.directory);
    commitAll(context.directory, 'record current architecture');
    writeEnforcementConfig(context.directory, false);
    const head = git(context.directory, 'rev-parse', 'HEAD').trim();
    git(
      context.directory,
      'update-index',
      '--add',
      '--cacheinfo',
      `160000,${head},vendor/submodule`,
    );

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.exitCode).toBe(0);
    expect(output).toContain('enforcement is opted out');
    expect(output).not.toContain('submodule gitlinks');
    expect(output).not.toContain('nothing was auto-staged');
    expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
  });

  it('reports an unstaged path configuration as a possible excluded architecture input', async () => {
    selfHeal(context.directory);
    commitAll(context.directory, 'record current architecture');
    mkdirSync(nodePath.join(context.directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot: 'docs' } }),
    );
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    git(context.directory, 'add', '--', 'src/billing/index.ts');

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('.safeword/config.json');
  });

  it('generates explicitly from the staged tree without automatically staging the doc', async () => {
    const stagedTreeFingerprint = shapeFingerprint(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'auth', 'editor'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'auth', 'editor', 'schema.sql'),
      'CREATE TABLE drafts (id integer);\n',
    );

    const result = await runCli(['architecture', '--staged'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
    const generated = execFileSync('cat', [DOC_RELATIVE], {
      cwd: context.directory,
      encoding: 'utf8',
    });
    expect(readDocumentFingerprint(generated)).toBe(stagedTreeFingerprint);
  });

  it('generates the package document when invoked from a repository subdirectory', async () => {
    rmSync(nodePath.join(context.directory, 'src'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    );
    const packageDirectory = nodePath.join(context.directory, 'packages', 'web');
    mkdirSync(nodePath.join(packageDirectory, 'src', 'api'), { recursive: true });
    writeFileSync(nodePath.join(packageDirectory, 'package.json'), JSON.stringify({ name: 'web' }));
    writeFileSync(
      nodePath.join(packageDirectory, 'src', 'api', 'index.ts'),
      'export const api = true;\n',
    );
    commitAll(context.directory, 'record monorepo fixture');

    const result = await runCli(['architecture', '--staged'], { cwd: packageDirectory });

    expect(result.exitCode).toBe(0);
    const packageDocument = nodePath.join(packageDirectory, DOC_RELATIVE);
    expect(readFileSync(packageDocument, 'utf8')).toContain('### api');
    expect(existsSync(nodePath.join(packageDirectory, 'packages', 'web', DOC_RELATIVE))).toBe(
      false,
    );
    expect(stagedFiles(context.directory)).not.toContain(
      nodePath.posix.join('packages/web', DOC_RELATIVE),
    );
  });

  it('restores a worktree doc that diverged from its current staged-tree version', async () => {
    selfHeal(context.directory);
    commitAll(context.directory, 'record current architecture');
    const stagedTreeFingerprint = shapeFingerprint(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'auth', 'editor'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'auth', 'editor', 'schema.sql'),
      'CREATE TABLE drafts (id integer);\n',
    );
    await runCli(['architecture'], { cwd: context.directory });
    const generatedPath = resolveGeneratedArchitecturePath(context.directory);
    writeFileSync(
      generatedPath,
      readFileSync(generatedPath, 'utf8').replace(
        'No description yet — awaiting prose.',
        'IMPORTANT HUMAN PROSE.',
      ),
    );
    expect(
      readDocumentFingerprint(execFileSync('cat', [generatedPath], { encoding: 'utf8' })),
    ).not.toBe(stagedTreeFingerprint);

    const result = await runCli(['architecture', '--staged'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
    const restored = execFileSync('cat', [generatedPath], { encoding: 'utf8' });
    expect(readDocumentFingerprint(restored)).toBe(stagedTreeFingerprint);
    expect(restored).toContain('IMPORTANT HUMAN PROSE.');
  });

  it('keeps worktree-only module prose as an orphan in explicit staged mode', async () => {
    selfHeal(context.directory);
    commitAll(context.directory, 'record current architecture');
    const stagedTreeFingerprint = shapeFingerprint(context.directory);
    const generatedPath = resolveGeneratedArchitecturePath(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'drafts'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'drafts', 'index.ts'),
      'export const drafts = true;\n',
    );
    await runCli(['architecture'], { cwd: context.directory });
    writeFileSync(
      generatedPath,
      readFileSync(generatedPath, 'utf8').replaceAll(
        'No description yet — awaiting prose.',
        'IMPORTANT WORKTREE PROSE.',
      ),
    );

    const result = await runCli(['architecture', '--staged'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    const restored = readFileSync(generatedPath, 'utf8');
    expect(readDocumentFingerprint(restored)).toBe(stagedTreeFingerprint);
    expect(restored).toContain('### drafts');
    expect(restored).toContain('orphaned');
    expect(restored).toContain('IMPORTANT WORKTREE PROSE.');
    expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);

    const repeated = await runCli(['architecture', '--staged'], { cwd: context.directory });

    expect(repeated.exitCode).toBe(0);
    const repeatedDocument = readFileSync(generatedPath, 'utf8');
    expect(repeatedDocument).toContain('### drafts');
    expect(repeatedDocument).toContain('orphaned');
    expect(repeatedDocument).toContain('IMPORTANT WORKTREE PROSE.');
    expect(repeatedDocument).toBe(restored);
  });

  it('does not overwrite a foreign worktree document in --staged mode', async () => {
    selfHeal(context.directory);
    commitAll(context.directory, 'record current architecture');
    const generatedPath = resolveGeneratedArchitecturePath(context.directory);
    const foreign = '# Human Architecture\n\nDO NOT DELETE THIS TEXT\n';
    writeFileSync(generatedPath, foreign);

    const result = await runCli(['architecture', '--staged'], { cwd: context.directory });

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('not owned by Safeword');
    expect(readFileSync(generatedPath, 'utf8')).toBe(foreign);
    expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
  });

  it('includes skip-worktree entries when exporting the staged tree', async () => {
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    selfHeal(context.directory);
    commitAll(context.directory, 'record sparse architecture');
    const stagedTreeFingerprint = shapeFingerprint(context.directory);
    git(context.directory, 'update-index', '--skip-worktree', 'src/billing/index.ts');
    rmSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    expect(shapeFingerprint(context.directory)).not.toBe(stagedTreeFingerprint);

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    const stagedDocument = git(context.directory, 'show', `:${DOC_RELATIVE}`);
    expect(readDocumentFingerprint(stagedDocument)).toBe(stagedTreeFingerprint);
  });

  it.each([
    ['--stage', 0],
    ['--staged', 1],
  ])(
    'refuses submodule gitlinks without orphaning the worktree in %s mode',
    async (mode, expectedExitCode) => {
      const submodule = createTemporaryDirectory();
      try {
        initGitRepo(submodule);
        mkdirSync(nodePath.join(submodule, 'src', 'core'), { recursive: true });
        writeFileSync(nodePath.join(submodule, 'package.json'), JSON.stringify({ name: 'shared' }));
        writeFileSync(
          nodePath.join(submodule, 'src', 'core', 'index.ts'),
          'export const core = true;\n',
        );
        git(submodule, 'add', '-A');
        git(submodule, 'commit', '-m', 'submodule fixture');

        rmSync(nodePath.join(context.directory, 'src'), { recursive: true });
        writeFileSync(
          nodePath.join(context.directory, 'package.json'),
          JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
        );
        commitAll(context.directory, 'record workspace root');
        git(
          context.directory,
          '-c',
          'protocol.file.allow=always',
          'submodule',
          'add',
          submodule,
          'packages/shared',
        );
        await runCli(['architecture'], { cwd: context.directory });
        git(context.directory, 'add', '-A');
        git(context.directory, 'commit', '-m', 'record submodule architecture');
        const documentPath = resolveGeneratedArchitecturePath(context.directory);
        const before = readFileSync(documentPath, 'utf8');
        expect(before).toContain('shared');

        const result = await runCli(['architecture', mode], { cwd: context.directory });

        expect(result.exitCode).toBe(expectedExitCode);
        expect(`${result.stdout}\n${result.stderr}`).toContain('submodule gitlinks');
        expect(readFileSync(documentPath, 'utf8')).toBe(before);
        expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
      } finally {
        removeTemporaryDirectory(submodule);
      }
    },
  );

  it('does not write outside the repo for an absolute staged projectRoot', async () => {
    const externalRoot = createTemporaryDirectory();
    try {
      mkdirSync(nodePath.join(context.directory, '.safeword'), { recursive: true });
      writeFileSync(
        nodePath.join(context.directory, '.safeword', 'config.json'),
        JSON.stringify({ paths: { projectRoot: externalRoot } }),
      );
      git(context.directory, 'add', '--', '.safeword/config.json');

      const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

      expect(result.exitCode).toBe(0);
      expect(existsSync(nodePath.join(externalRoot, 'architecture.generated.md'))).toBe(false);
      expect(`${result.stdout}\n${result.stderr}`).toContain('nothing was auto-staged');
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        'staged projectRoot resolves outside the repository',
      );
    } finally {
      removeTemporaryDirectory(externalRoot);
    }
  });

  it.each([
    ['--stage', 0],
    ['--staged', 1],
  ])(
    'does not follow a tracked projectRoot symlink outside the repo in %s mode',
    async (mode, expectedExitCode) => {
      const externalRoot = createTemporaryDirectory();
      try {
        const linkedRoot = nodePath.join(context.directory, 'linked-root');
        const configuredLinkedRoot = nodePath.join(realpathSync(context.directory), 'linked-root');
        symlinkSync(externalRoot, linkedRoot, 'dir');
        mkdirSync(nodePath.join(context.directory, '.safeword'), { recursive: true });
        writeFileSync(
          nodePath.join(context.directory, '.safeword', 'config.json'),
          JSON.stringify({ paths: { projectRoot: configuredLinkedRoot } }),
        );
        git(context.directory, 'add', '--', '.safeword/config.json', 'linked-root');

        const result = await runCli(['architecture', mode], { cwd: context.directory });

        expect(result.exitCode).toBe(expectedExitCode);
        expect(readdirSync(externalRoot)).toEqual([]);
      } finally {
        removeTemporaryDirectory(externalRoot);
      }
    },
  );

  it('preflights every destination before replacing a divergent root document', async () => {
    const externalRoot = createTemporaryDirectory();
    try {
      rmSync(nodePath.join(context.directory, 'src'), { recursive: true });
      writeFileSync(
        nodePath.join(context.directory, 'package.json'),
        JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
      );
      for (const packageName of ['a', 'b']) {
        const packageDirectory = nodePath.join(context.directory, 'packages', packageName);
        mkdirSync(nodePath.join(packageDirectory, 'src'), { recursive: true });
        writeFileSync(
          nodePath.join(packageDirectory, 'package.json'),
          JSON.stringify({ name: packageName }),
        );
        writeFileSync(
          nodePath.join(packageDirectory, 'src', 'index.ts'),
          `export const ${packageName} = true;\n`,
        );
      }
      selfHealProject(context.directory);
      commitAll(context.directory, 'record monorepo architecture');

      const rootDocument = resolveGeneratedArchitecturePath(context.directory);
      const rootWithSentinel = `${readFileSync(rootDocument, 'utf8')}\nROOT WORKTREE SENTINEL\n`;
      writeFileSync(rootDocument, rootWithSentinel);

      const packageB = nodePath.join(context.directory, 'packages', 'b');
      writeFileSync(nodePath.join(packageB, 'src', 'new.ts'), 'export const next = true;\n');
      const packageC = nodePath.join(context.directory, 'packages', 'c');
      mkdirSync(nodePath.join(packageC, 'src'), { recursive: true });
      writeFileSync(nodePath.join(packageC, 'package.json'), JSON.stringify({ name: 'c' }));
      writeFileSync(nodePath.join(packageC, 'src', 'index.ts'), 'export const c = true;\n');
      git(
        context.directory,
        'add',
        '--',
        'packages/b/src/new.ts',
        'packages/c/package.json',
        'packages/c/src/index.ts',
      );

      const externalDocument = nodePath.join(externalRoot, 'architecture.generated.md');
      writeFileSync(externalDocument, 'EXTERNAL SENTINEL\n');
      const packageBDocument = nodePath.join(packageB, 'architecture.generated.md');
      rmSync(packageBDocument);
      symlinkSync(externalDocument, packageBDocument);

      const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain('physically escapes');
      expect(readFileSync(rootDocument, 'utf8')).toBe(rootWithSentinel);
      expect(readFileSync(externalDocument, 'utf8')).toBe('EXTERNAL SENTINEL\n');
      expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
      expect(stagedFiles(context.directory)).not.toContain('packages/b/architecture.generated.md');
    } finally {
      removeTemporaryDirectory(externalRoot);
    }
  });

  it('skips a foreign leaf while staging healthy monorepo siblings', async () => {
    rmSync(nodePath.join(context.directory, 'src'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    );
    for (const packageName of ['core', 'web']) {
      const packageDirectory = nodePath.join(context.directory, 'packages', packageName);
      mkdirSync(nodePath.join(packageDirectory, 'src'), { recursive: true });
      writeFileSync(
        nodePath.join(packageDirectory, 'package.json'),
        JSON.stringify({ name: packageName }),
      );
      writeFileSync(
        nodePath.join(packageDirectory, 'src', 'index.ts'),
        `export const ${packageName} = true;\n`,
      );
    }
    selfHealProject(context.directory);
    commitAll(context.directory, 'record monorepo architecture');

    const coreDocument = nodePath.join(
      context.directory,
      'packages',
      'core',
      'architecture.generated.md',
    );
    const foreign = '# Core Architecture\n\nMaintained by the core team.\n';
    writeFileSync(coreDocument, foreign);

    for (const packageName of ['core', 'web']) {
      const modulePath = nodePath.join(
        context.directory,
        'packages',
        packageName,
        'src',
        'next.ts',
      );
      writeFileSync(modulePath, `export const ${packageName}Next = true;\n`);
      git(context.directory, 'add', '--', nodePath.relative(context.directory, modulePath));
    }

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('not owned by Safeword');
    expect(`${result.stdout}\n${result.stderr}`).toContain(coreDocument);
    expect(readFileSync(coreDocument, 'utf8')).toBe(foreign);
    expect(stagedFiles(context.directory)).not.toContain('packages/core/architecture.generated.md');
    expect(stagedFiles(context.directory)).toContain('packages/web/architecture.generated.md');
  });

  it('reports multiple skipped foreign documents truthfully', async () => {
    rmSync(nodePath.join(context.directory, 'src'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    );
    for (const packageName of ['core', 'web']) {
      const packageDirectory = nodePath.join(context.directory, 'packages', packageName);
      mkdirSync(nodePath.join(packageDirectory, 'src'), { recursive: true });
      writeFileSync(
        nodePath.join(packageDirectory, 'package.json'),
        JSON.stringify({ name: packageName }),
      );
      writeFileSync(
        nodePath.join(packageDirectory, 'src', 'index.ts'),
        `export const ${packageName} = true;\n`,
      );
    }
    selfHealProject(context.directory);
    commitAll(context.directory, 'record monorepo architecture');

    for (const packageName of ['core', 'web']) {
      const packageDirectory = nodePath.join(context.directory, 'packages', packageName);
      writeFileSync(
        nodePath.join(packageDirectory, 'architecture.generated.md'),
        `# ${packageName} Architecture\n\nMaintained by the ${packageName} team.\n`,
      );
      const modulePath = nodePath.join(packageDirectory, 'src', 'next.ts');
      writeFileSync(modulePath, `export const ${packageName}Next = true;\n`);
      git(context.directory, 'add', '--', nodePath.relative(context.directory, modulePath));
    }

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.exitCode).toBe(0);
    expect(output).toContain(
      'Architecture docs left unchanged (2 documents are not Safeword-owned).',
    );
    expect(output).not.toContain('Architecture docs need no change.');
    expect(stagedFiles(context.directory)).not.toContain('packages/core/architecture.generated.md');
    expect(stagedFiles(context.directory)).not.toContain('packages/web/architecture.generated.md');
  });

  it('restores earlier documents when a later destination replacement fails', async () => {
    rmSync(nodePath.join(context.directory, 'src'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    );
    for (const packageName of ['a', 'b']) {
      const packageDirectory = nodePath.join(context.directory, 'packages', packageName);
      mkdirSync(nodePath.join(packageDirectory, 'src'), { recursive: true });
      writeFileSync(
        nodePath.join(packageDirectory, 'package.json'),
        JSON.stringify({ name: packageName }),
      );
      writeFileSync(
        nodePath.join(packageDirectory, 'src', 'index.ts'),
        `export const ${packageName} = true;\n`,
      );
    }
    selfHealProject(context.directory);
    commitAll(context.directory, 'record monorepo architecture');

    const rootDocument = resolveGeneratedArchitecturePath(context.directory);
    const rootWithSentinel = `${readFileSync(rootDocument, 'utf8')}\nROOT WORKTREE SENTINEL\n`;
    writeFileSync(rootDocument, rootWithSentinel);

    const packageB = nodePath.join(context.directory, 'packages', 'b');
    const packageBModule = nodePath.join(packageB, 'src', 'billing');
    mkdirSync(packageBModule);
    writeFileSync(nodePath.join(packageBModule, 'index.ts'), 'export const billing = true;\n');
    const packageC = nodePath.join(context.directory, 'packages', 'c');
    mkdirSync(nodePath.join(packageC, 'src'), { recursive: true });
    writeFileSync(nodePath.join(packageC, 'package.json'), JSON.stringify({ name: 'c' }));
    writeFileSync(nodePath.join(packageC, 'src', 'index.ts'), 'export const c = true;\n');
    git(
      context.directory,
      'add',
      '--',
      'packages/b/src/billing/index.ts',
      'packages/c/package.json',
      'packages/c/src/index.ts',
    );

    chmodSync(packageB, 0o555);
    try {
      const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain('nothing was auto-staged');
      expect(readFileSync(rootDocument, 'utf8')).toBe(rootWithSentinel);
      expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
      expect(stagedFiles(context.directory)).not.toContain('packages/b/architecture.generated.md');
    } finally {
      chmodSync(packageB, 0o755);
    }
  });

  it.each([
    ['--stage', 0],
    ['--staged', 1],
  ])(
    'does not follow an unstaged worktree destination symlink in %s mode',
    async (mode, expectedExitCode) => {
      const externalRoot = createTemporaryDirectory();
      try {
        symlinkSync(externalRoot, nodePath.join(context.directory, '.project'), 'dir');

        const result = await runCli(['architecture', mode], { cwd: context.directory });

        expect(result.exitCode).toBe(expectedExitCode);
        expect(readdirSync(externalRoot)).toEqual([]);
      } finally {
        removeTemporaryDirectory(externalRoot);
      }
    },
  );

  it.each([
    ['--stage', 0],
    ['--staged', 1],
  ])(
    'does not overwrite an unstaged generated-document symlink in %s mode',
    async (mode, expectedExitCode) => {
      const externalRoot = createTemporaryDirectory();
      try {
        mkdirSync(nodePath.join(context.directory, '.project'));
        symlinkSync(
          nodePath.join(externalRoot, 'architecture.generated.md'),
          resolveGeneratedArchitecturePath(context.directory),
        );

        const result = await runCli(['architecture', mode], { cwd: context.directory });

        expect(result.exitCode).toBe(expectedExitCode);
        expect(readdirSync(externalRoot)).toEqual([]);
      } finally {
        removeTemporaryDirectory(externalRoot);
      }
    },
  );

  it.each([
    ['--stage', 0],
    ['--staged', 1],
  ])(
    'does not heal through a tracked workspace symlink in %s mode',
    async (mode, expectedExitCode) => {
      const externalRoot = createTemporaryDirectory();
      try {
        mkdirSync(nodePath.join(externalRoot, 'src', 'core'), { recursive: true });
        writeFileSync(
          nodePath.join(externalRoot, 'package.json'),
          JSON.stringify({ name: 'external-workspace' }),
        );
        writeFileSync(
          nodePath.join(externalRoot, 'src', 'core', 'index.ts'),
          'export const core = true;\n',
        );
        writeFileSync(
          nodePath.join(context.directory, 'package.json'),
          JSON.stringify({ name: 'fixture', workspaces: ['packages/*'] }),
        );
        mkdirSync(nodePath.join(context.directory, 'packages'), { recursive: true });
        symlinkSync(externalRoot, nodePath.join(context.directory, 'packages', 'escape'), 'dir');
        git(context.directory, 'add', '--', 'package.json', 'packages/escape');

        const result = await runCli(['architecture', mode], { cwd: context.directory });

        expect(result.exitCode).toBe(expectedExitCode);
        expect(existsSync(nodePath.join(externalRoot, 'architecture.generated.md'))).toBe(false);
      } finally {
        removeTemporaryDirectory(externalRoot);
      }
    },
  );

  it.each([
    ['--stage', 0],
    ['--staged', 1],
  ])(
    'does not overwrite an external inode through a worktree hard link in %s mode',
    async (mode, expectedExitCode) => {
      const externalRoot = createTemporaryDirectory();
      try {
        const externalDocument = nodePath.join(externalRoot, 'architecture.generated.md');
        const sentinel = 'external sentinel\n';
        writeFileSync(externalDocument, sentinel);
        mkdirSync(nodePath.join(context.directory, '.project'));
        const generatedPath = resolveGeneratedArchitecturePath(context.directory);
        linkSync(externalDocument, generatedPath);

        const result = await runCli(['architecture', mode], { cwd: context.directory });

        expect(result.exitCode).toBe(expectedExitCode);
        expect(readFileSync(externalDocument, 'utf8')).toBe(sentinel);
        expect(readFileSync(generatedPath, 'utf8')).toBe(sentinel);
      } finally {
        removeTemporaryDirectory(externalRoot);
      }
    },
  );

  it.each([
    ['--stage', 0],
    ['--staged', 1],
  ])('reports a missing Git executable in %s mode', async (mode, expectedExitCode) => {
    const result = await runCli(['architecture', mode], {
      cwd: context.directory,
      env: { PATH: '' },
    });

    expect(result.exitCode).toBe(expectedExitCode);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Git executable is unavailable');
  });
});

describe('architecture staged-tree modes outside Git', () => {
  it.each(['--stage', '--staged'])('falls back to worktree generation for %s', async mode => {
    const directory = createTemporaryDirectory();
    try {
      mkdirSync(nodePath.join(directory, 'src', 'auth'), { recursive: true });
      writeFileSync(
        nodePath.join(directory, 'src', 'auth', 'index.ts'),
        'export const auth = true;\n',
      );
      writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'fixture' }));

      const result = await runCli(['architecture', mode], { cwd: directory });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        'No Git worktree found; generated from the worktree instead',
      );
      expect(readFileSync(resolveGeneratedArchitecturePath(directory), 'utf8')).toContain(
        '### auth',
      );
    } finally {
      removeTemporaryDirectory(directory);
    }
  });
});
