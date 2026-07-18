/**
 * Integration tests for scripts/check-version-sync.ts.
 *
 * Exercises the same guard the pre-commit hook invokes, against an isolated
 * release fixture so a stale Codex hook command cannot hide behind the host
 * repository's current version.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..', '..', '..', '..');
const SCRIPT_PATH = nodePath.join(REPO_ROOT, 'scripts', 'check-version-sync.ts');
const CODEX_EVENTS = [
  'session-start',
  'pre-tool-use',
  'post-tool-use',
  'user-prompt-submit',
  'stop',
];

function writeReleaseFixture(
  projectDirectory: string,
  version: string,
  hookVersion = version,
): void {
  const cliDirectory = nodePath.join(projectDirectory, 'packages', 'cli');
  const pluginDirectory = nodePath.join(cliDirectory, 'codex-plugin', '.codex-plugin');
  const hooks: Record<string, { hooks: { command: string }[] }[]> = {};
  mkdirSync(pluginDirectory, { recursive: true });
  mkdirSync(nodePath.join(projectDirectory, '.claude-plugin'), { recursive: true });

  for (const event of CODEX_EVENTS) {
    hooks[event] = [
      { hooks: [{ command: `bunx --bun safeword@${hookVersion} hook codex ${event}` }] },
    ];
  }

  writeFileSync(nodePath.join(cliDirectory, 'package.json'), JSON.stringify({ version }));
  writeFileSync(
    nodePath.join(projectDirectory, '.claude-plugin', 'marketplace.json'),
    JSON.stringify({ plugins: [{ version }] }),
  );
  writeFileSync(nodePath.join(pluginDirectory, 'plugin.json'), JSON.stringify({ version }));
  writeFileSync(
    nodePath.join(cliDirectory, 'codex-plugin', 'hooks.json'),
    JSON.stringify({ hooks }),
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

describe('scripts/check-version-sync.ts', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('accepts matching release manifests and pinned Codex hook commands', () => {
    writeReleaseFixture(projectDirectory, '1.2.3');

    expect(runGuard(projectDirectory).exitCode).toBe(0);
  });

  it('rejects a Codex hook command pinned to a stale CLI version', () => {
    writeReleaseFixture(projectDirectory, '1.2.3', '1.2.2');

    const result = runGuard(projectDirectory);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('hooks.json');
    expect(result.stderr).toContain('safeword@1.2.3');
  });
});
