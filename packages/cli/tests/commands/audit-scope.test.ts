import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, initGitRepo, removeTemporaryDirectory } from '../helpers.js';

const temporaryDirectories: string[] = [];
const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const sourceCli = nodePath.resolve(import.meta.dirname, '../../src/cli.ts');

function createEnrolledFeatureBranch(withChanges = true): { project: string; mergeBase: string } {
  const project = createTemporaryDirectory();
  temporaryDirectories.push(project);
  initGitRepo(project);
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# enrolled\n');
  writeFileSync(nodePath.join(project, 'first.txt'), 'base\n');
  spawnSync('git', ['add', '.'], { cwd: project });
  spawnSync('git', ['commit', '--no-verify', '-m', 'base'], { cwd: project });
  const mergeBase = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: project,
    encoding: 'utf8',
  }).stdout.trim();
  spawnSync('git', ['branch', '-M', 'main'], { cwd: project });
  spawnSync('git', ['switch', '-c', 'feature'], { cwd: project });
  if (withChanges) {
    writeFileSync(nodePath.join(project, 'first.txt'), 'changed\n');
    writeFileSync(nodePath.join(project, 'second.txt'), 'added\n');
  }
  return { project, mergeBase };
}

function createInstalledCursorFeatureBranch(): { project: string; mergeBase: string } {
  const project = createTemporaryDirectory();
  temporaryDirectories.push(project);
  initGitRepo(project);
  writeFileSync(nodePath.join(project, 'first.txt'), 'base\n');
  const installed = spawnSync(
    'bun',
    [
      sourceCli,
      'install',
      '--agents=cursor',
      '--no-modify',
      '--no-input',
      '--cwd',
      project,
      '--json',
    ],
    { cwd: project, encoding: 'utf8' },
  );
  expect(installed.status, installed.stderr || installed.stdout).toBe(0);
  spawnSync('git', ['add', '.'], { cwd: project });
  spawnSync('git', ['commit', '--no-verify', '-m', 'base'], { cwd: project });
  const mergeBase = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: project,
    encoding: 'utf8',
  }).stdout.trim();
  spawnSync('git', ['branch', '-M', 'main'], { cwd: project });
  spawnSync('git', ['switch', '-c', 'feature'], { cwd: project });
  writeFileSync(nodePath.join(project, 'first.txt'), 'changed\n');
  writeFileSync(nodePath.join(project, 'second.txt'), 'added\n');
  return { project, mergeBase };
}

function sourcePackagedScope(project: string, baseReference: string): ReturnType<typeof spawnSync> {
  return spawnSync(
    'bash',
    [
      '-c',
      [
        `source <(bun "${cli}" project audit-scope)`,
        'audit_scope_initialize "$PROJECT_DIR"',
        'status=$?',
        String.raw`printf "status=%s\nmode=%s\nsha=%s\nfiles=%s\n" "$status" "$AUDIT_SCOPE_MODE" "$AUDIT_BASE_SHA" "$AUDIT_CHANGED_FILES"`,
        String.raw`printf "caller=available\n"`,
      ].join('; '),
    ],
    {
      cwd: project,
      env: {
        ...process.env,
        PROJECT_DIR: project,
        SAFEWORD_AUDIT_BASE_REF: baseReference,
      },
      encoding: 'utf8',
    },
  );
}

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
});

describe('packaged audit scope command', () => {
  it('executes the shared-shell helper without project runtime', () => {
    const { project, mergeBase } = createEnrolledFeatureBranch();

    const result = sourcePackagedScope(project, 'main');

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('status=0\nmode=diff');
    expect(result.stdout).toContain(`sha=${mergeBase}`);
    expect(result.stdout).toContain('files=first.txt\nsecond.txt');
    expect(result.stdout).toContain('caller=available');
    expect(result.stdout).not.toMatch(/install|dependenc/iu);
  });

  it('preserves the caller shell and empty exports when merge-base resolution fails', () => {
    const { project } = createEnrolledFeatureBranch();

    const result = sourcePackagedScope(project, 'missing-base');

    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      'SAFEWORD_AUDIT_BASE_REF does not resolve to a Git commit: missing-base',
    );
    expect(result.stdout).toContain('status=2\nmode=repository\nsha=\nfiles=');
    expect(result.stdout).toContain('caller=available');
  });

  it('exports an empty changed-file list through a sourced caller shell', () => {
    const { project, mergeBase } = createEnrolledFeatureBranch(false);

    const result = sourcePackagedScope(project, 'main');

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(`status=0\nmode=diff\nsha=${mergeBase}\nfiles=\n`);
    expect(result.stdout).toContain('caller=available');
    expect(result.stdout).not.toMatch(/install|dependenc/iu);
  });

  it('executes the installed Cursor audit workflow from project authority', () => {
    const { project, mergeBase } = createInstalledCursorFeatureBranch();
    const command = readFileSync(nodePath.join(project, '.cursor/commands/audit.md'), 'utf8');
    const skill = readFileSync(nodePath.join(project, '.safeword/skills/audit/SKILL.md'), 'utf8');

    expect(command).toContain(
      'Read and follow the instructions in .safeword/skills/audit/SKILL.md',
    );
    expect(skill).toContain('source "$PROJECT_DIR/.safeword/hooks/lib/audit-scope.sh"');
    expect(existsSync(nodePath.join(project, '.claude/skills'))).toBe(false);
    expect(existsSync(nodePath.join(project, '.codex/skills'))).toBe(false);
    expect(existsSync(nodePath.join(project, '.opencode'))).toBe(false);

    const result = spawnSync(
      'bash',
      [
        '-c',
        [
          'source "$PROJECT_DIR/.safeword/hooks/lib/audit-scope.sh"',
          'audit_scope_initialize "$PROJECT_DIR"',
          String.raw`printf "mode=%s\nsha=%s\nfiles=%s\n" "$AUDIT_SCOPE_MODE" "$AUDIT_BASE_SHA" "$AUDIT_CHANGED_FILES"`,
        ].join('; '),
      ],
      {
        cwd: project,
        env: { ...process.env, PROJECT_DIR: project, SAFEWORD_AUDIT_BASE_REF: 'main' },
        encoding: 'utf8',
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('mode=diff');
    expect(result.stdout).toContain(`sha=${mergeBase}`);
    expect(result.stdout).toContain('files=first.txt\nsecond.txt');
    expect(`${result.stdout}${result.stderr}`).not.toMatch(/install|dependenc/iu);
  });
});
