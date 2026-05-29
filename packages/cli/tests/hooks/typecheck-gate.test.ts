/**
 * Unit tests for the implement-phase-stop typecheck gate (ticket SW1SE5,
 * test-definitions.md Rule 1). The pure decision logic — given a project
 * dir, a list of changed files, and the current phase, decide whether to
 * run `tsc --noEmit` and which `tsconfig.json` to use (find-up).
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { shouldRunTypecheck } from '../../templates/hooks/lib/typecheck-gate.js';

function makeProject(): string {
  return mkdtempSync(nodePath.join(tmpdir(), 'tcgate-'));
}

function touch(absolutePath: string): void {
  mkdirSync(nodePath.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, '');
}

describe('shouldRunTypecheck (Rule 1 — run-gate)', () => {
  it('runs when root tsconfig.json exists and a .ts file changed', () => {
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['src/foo.ts'],
      phase: 'implement',
    });

    expect(result.run).toBe(true);
    if (result.run) {
      expect(result.tsconfigPath).toBe(nodePath.join(projectDirectory, 'tsconfig.json'));
    }
  });

  it('skips when no tsconfig.json exists anywhere above the changed file', () => {
    const projectDirectory = makeProject();
    // No tsconfig anywhere.

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['src/foo.ts'],
      phase: 'implement',
    });

    expect(result.run).toBe(false);
  });

  it('skips when zero TS files changed this session', () => {
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['README.md', 'src/notes.json'],
      phase: 'implement',
    });

    expect(result.run).toBe(false);
  });

  it('finds a package-level tsconfig via find-up when no root tsconfig exists (monorepo)', () => {
    const projectDirectory = makeProject();
    // No root tsconfig; package-level one only.
    touch(nodePath.join(projectDirectory, 'packages/cli/tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['packages/cli/src/foo.ts'],
      phase: 'implement',
    });

    expect(result.run).toBe(true);
    if (result.run) {
      expect(result.tsconfigPath).toBe(
        nodePath.join(projectDirectory, 'packages/cli/tsconfig.json'),
      );
    }
  });

  it('treats .tsx / .mts / .cts as TypeScript files', () => {
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['App.tsx', 'node.mts', 'legacy.cts'],
      phase: 'implement',
    });

    expect(result.run).toBe(true);
  });

  it('skips at done phase even when a TS file changed and tsconfig exists', () => {
    const projectDirectory = makeProject();
    touch(nodePath.join(projectDirectory, 'tsconfig.json'));

    const result = shouldRunTypecheck({
      projectDirectory,
      changedFiles: ['src/foo.ts'],
      phase: 'done',
    });

    expect(result.run).toBe(false);
  });
});
