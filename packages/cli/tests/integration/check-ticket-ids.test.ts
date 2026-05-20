/**
 * Integration test for scripts/check-ticket-ids.ts (ticket 158, slice 5).
 *
 * Exercises the script the way pre-commit and CI invoke it: `bun
 * scripts/check-ticket-ids.ts` from a project root with a tickets directory.
 * Synthetic state — never relies on the host repo's actual ticket layout.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..', '..', '..', '..');
const SCRIPT_PATH = nodePath.join(REPO_ROOT, 'scripts', 'check-ticket-ids.ts');

function makeTicket(projectDirectory: string, folder: string, id: string): void {
  const directory = nodePath.join(projectDirectory, '.safeword-project', 'tickets', folder);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    nodePath.join(directory, 'ticket.md'),
    `---
id: ${id}
type: task
status: in_progress
---

# Test
`,
  );
}

function runGuard(projectDirectory: string): { exitCode: number; stderr: string } {
  const result = spawnSync('bun', [SCRIPT_PATH], {
    cwd: projectDirectory,
    encoding: 'utf8',
    timeout: 10_000,
  });
  return { exitCode: result.status ?? -1, stderr: result.stderr };
}

describe('scripts/check-ticket-ids.ts', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('exits 0 on a clean synthetic state (no duplicates)', () => {
    makeTicket(projectDirectory, '080-foo', '080');
    makeTicket(projectDirectory, '102a-bar', '102a');
    makeTicket(projectDirectory, '7K9M3P', '7K9M3P');
    const { exitCode } = runGuard(projectDirectory);
    expect(exitCode).toBe(0);
  });

  it('exits non-zero when two NEW-format folders share an id', () => {
    makeTicket(projectDirectory, '7K9M3P', '7K9M3P');
    makeTicket(projectDirectory, '7K9M3Q', '7K9M3P');
    const { exitCode, stderr } = runGuard(projectDirectory);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('7K9M3P');
  });

  it('exits non-zero when two LEGACY-format folders share an id', () => {
    makeTicket(projectDirectory, '080-original', '080');
    makeTicket(projectDirectory, '080-duplicate', '080');
    const { exitCode, stderr } = runGuard(projectDirectory);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('080');
  });

  it('failure message names both offending folder paths', () => {
    makeTicket(projectDirectory, '7K9M3P', '7K9M3P');
    makeTicket(projectDirectory, '7K9M3Q', '7K9M3P');
    const { stderr } = runGuard(projectDirectory);
    expect(stderr).toContain('7K9M3P/');
    expect(stderr).toContain('7K9M3Q/');
  });
});
