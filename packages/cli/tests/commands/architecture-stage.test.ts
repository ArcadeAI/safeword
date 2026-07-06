/**
 * Integration tests for `safeword architecture --stage` — the commit-time
 * auto-fix-and-stage surface (ticket FPV0E4, Slice 2, TB1/TB3.AC1). Runs the
 * built CLI inside a real temp git repo and asserts the git index, because the
 * contract IS the side effect: regenerate a stale doc and `git add` it, never
 * block, never touch a doc that needs no change or that safeword does not own.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readDocumentFingerprint,
  selfHeal,
  selfHealProject,
} from '../../src/utils/architecture-document.js';
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

beforeEach(() => {
  context.directory = createTemporaryDirectory();
  initGitRepo(context.directory);
  mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });
  writeFileSync(
    nodePath.join(context.directory, 'package.json'),
    JSON.stringify({ name: 'fixture' }),
  );
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
    expect(readDocumentFingerprint(content)).toBeDefined();
  });

  it('regenerates and stages a stale doc', async () => {
    selfHeal(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });

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
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });

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
  });

  it('does not stage a doc that already matches the current shape', async () => {
    selfHeal(context.directory);

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
  });

  it('never touches or stages a foreign hand-written doc', async () => {
    mkdirSync(resolveNamespaceRoot(context.directory), { recursive: true });
    const foreign = '# Our Architecture\n\nHand-written, no marker.\n';
    writeFileSync(resolveGeneratedArchitecturePath(context.directory), foreign);

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
    expect(execFileSync('cat', [DOC_RELATIVE], { cwd: context.directory, encoding: 'utf8' })).toBe(
      foreign,
    );
  });

  it('preserves an unrelated staged change while staging the regenerated doc', async () => {
    selfHeal(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    writeFileSync(nodePath.join(context.directory, 'NOTES.md'), 'unrelated work\n');
    execFileSync('git', ['add', '--', 'NOTES.md'], { cwd: context.directory });

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
    writeEnforcementConfig(context.directory, false);

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(stagedFiles(context.directory)).not.toContain(DOC_RELATIVE);
    expect(execFileSync('cat', [DOC_RELATIVE], { cwd: context.directory, encoding: 'utf8' })).toBe(
      before,
    );
  });

  it('still surfaces the narrative-drift advisory when enforcement is opted out', async () => {
    // Coverage honesty is independent of enforcement: an opted-out host running
    // --stage must still be told the narrative omits a generated package, matching
    // --check and default mode (#864 follow-up). Needs a monorepo — drift is a
    // root `## Packages` concern; single-repo `## Modules` names are never scanned.
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
    // Narrative mentions only "web" → "billing" is drift.
    writeFileSync(
      nodePath.join(context.directory, 'ARCHITECTURE.md'),
      '# Architecture\n\nThe web package serves the UI.\n',
    );
    // Pre-generate the root `## Packages` index: the opt-out branch skips the heal,
    // so the drift check reads whatever generated doc already exists on disk.
    selfHealProject(context.directory);
    writeEnforcementConfig(context.directory, false);

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).toContain('does not mention');
    expect(output).toContain('billing');
  });

  it('exits zero even with no modules and no doc (noop never blocks)', async () => {
    execFileSync('rm', ['-rf', 'src'], { cwd: context.directory });

    const result = await runCli(['architecture', '--stage'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
    expect(existsSync(resolveGeneratedArchitecturePath(context.directory))).toBe(false);
  });
});
