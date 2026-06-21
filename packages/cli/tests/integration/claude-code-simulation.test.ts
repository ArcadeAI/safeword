/**
 * E2E Test: Claude Code Hook Path Resolution
 *
 * Simulates Claude Code executing hooks from a DIFFERENT working directory.
 * This catches the bug where relative paths fail because Claude Code's cwd
 * differs from the project root.
 *
 * Path format is tested in conditional-setup.test.ts.
 * Hook behavior is tested in hooks.test.ts.
 * This only tests that hooks are reachable from different cwd.
 */

import { spawnSync } from 'node:child_process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  setupOrThrow,
} from '../helpers';

describe('E2E: Claude Code Hook Path Resolution', () => {
  let projectDirectory: string;
  let differentDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createTypeScriptPackageJson(projectDirectory);
    initGitRepo(projectDirectory);
    await setupOrThrow(projectDirectory, ['setup']);
    differentDirectory = createTemporaryDirectory();
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) removeTemporaryDirectory(projectDirectory);
    if (differentDirectory) removeTemporaryDirectory(differentDirectory);
  });

  // eslint-disable-next-line complexity -- Complexity 12, threshold 10; nested loops match nested hook structure in settings
  it('all hooks execute without "not found" errors from different cwd', () => {
    const settings = JSON.parse(readTestFile(projectDirectory, '.claude/settings.json'));
    const commands: string[] = [];

    // Extract all hook commands
    const hookGroups = Object.values(settings.hooks || {});
    for (const entries of hookGroups) {
      for (const entry of entries as {
        hooks: { type: string; command: string }[];
      }[]) {
        for (const hook of entry.hooks) {
          if (hook.type === 'command') commands.push(hook.command);
        }
      }
    }

    expect(commands.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const command of commands) {
      const result = spawnSync('/bin/sh', ['-c', command], {
        cwd: differentDirectory, // Simulates Claude Code running from different directory
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
        encoding: 'utf8',
        timeout: 10_000,
      });

      if (result.status === 127 || /not found|no such file/i.test(result.stderr + result.stdout)) {
        failures.push(`${command}\n  → ${result.stderr || result.stdout || 'exit 127'}`);
      }
    }

    if (failures.length > 0) {
      expect.fail(`Hooks not reachable from different cwd:\n\n${failures.join('\n\n')}`);
    }
  });
});
