/**
 * Integration test for scripts/check-pr-ticket-done.ts (#365).
 *
 * Exercises the CI guard the way the workflow invokes it: pass a PR changed-file
 * list and inspect ticket.md frontmatter in a synthetic checkout.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..', '..', '..', '..');
const SCRIPT_PATH = nodePath.join(REPO_ROOT, 'scripts', 'check-pr-ticket-done.ts');

function writeTicket(
  projectDirectory: string,
  folder: string,
  frontmatter: { status?: string; phase?: string },
): void {
  const directory = nodePath.join(projectDirectory, '.project', 'tickets', folder);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    nodePath.join(directory, 'ticket.md'),
    [
      '---',
      'id: TICKET',
      'type: task',
      frontmatter.status ? `status: ${frontmatter.status}` : undefined,
      frontmatter.phase ? `phase: ${frontmatter.phase}` : undefined,
      '---',
      '',
      '# Test',
      '',
    ]
      .filter(line => line !== undefined)
      .join('\n'),
  );
}

function runGuard(
  projectDirectory: string,
  changedFiles: string[],
): { exitCode: number; stderr: string } {
  const changedFilesPath = nodePath.join(projectDirectory, 'changed-files.txt');
  writeFileSync(changedFilesPath, `${changedFiles.join('\n')}\n`);

  const result = spawnSync('bun', [SCRIPT_PATH, '--changed-files', changedFilesPath], {
    cwd: projectDirectory,
    encoding: 'utf8',
    timeout: 10_000,
  });

  return { exitCode: result.status ?? -1, stderr: result.stderr };
}

describe('scripts/check-pr-ticket-done.ts', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('exits 0 when no safeword ticket folders changed', () => {
    const { exitCode } = runGuard(projectDirectory, ['packages/cli/src/cli.ts']);
    expect(exitCode).toBe(0);
  });

  it('exits 0 when every changed active ticket is closed', () => {
    writeTicket(projectDirectory, 'ABC123-demo', { status: 'done', phase: 'done' });

    const { exitCode } = runGuard(projectDirectory, [
      '.project/tickets/ABC123-demo/ticket.md',
      '.project/tickets/ABC123-demo/verify.md',
    ]);

    expect(exitCode).toBe(0);
  });

  it('exits 0 for legacy closed tickets without phase done', () => {
    writeTicket(projectDirectory, 'ABC123-demo', { status: 'done', phase: 'intake' });

    const { exitCode } = runGuard(projectDirectory, ['.project/tickets/ABC123-demo/ticket.md']);

    expect(exitCode).toBe(0);
  });

  it('ignores sibling ticket artifacts when ticket.md did not change', () => {
    writeTicket(projectDirectory, 'ABC123-demo', { status: 'in_progress', phase: 'implement' });

    const { exitCode } = runGuard(projectDirectory, [
      '.project/tickets/ABC123-demo/verify.md',
      '.project/tickets/ABC123-demo/test-definitions.md',
    ]);

    expect(exitCode).toBe(0);
  });

  it('exits non-zero when a changed active ticket is still in progress', () => {
    writeTicket(projectDirectory, 'ABC123-demo', { status: 'in_progress', phase: 'done' });

    const { exitCode, stderr } = runGuard(projectDirectory, [
      '.project/tickets/ABC123-demo/ticket.md',
    ]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('ABC123-demo/ticket.md');
    expect(stderr).toContain('status: in_progress');
  });

  it('exits non-zero when a changed active ticket.md is missing', () => {
    const { exitCode, stderr } = runGuard(projectDirectory, [
      '.project/tickets/ABC123-demo/ticket.md',
    ]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('ABC123-demo/ticket.md');
    expect(stderr).toContain('ticket.md is missing');
  });

  it('ignores completed archive changes', () => {
    const { exitCode } = runGuard(projectDirectory, [
      '.project/tickets/completed/ABC123-demo/ticket.md',
    ]);

    expect(exitCode).toBe(0);
  });
});
