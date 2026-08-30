/**
 * Integration tests for scripts/check-version-sync.ts.
 *
 * Exercises the same guard the pre-commit hook invokes, against an isolated
 * release fixture so a stale Codex hook command cannot hide behind the host
 * repository's current version.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..', '..', '..', '..');
const SCRIPT_PATH = nodePath.join(REPO_ROOT, 'scripts', 'check-version-sync.ts');
const CODEX_EVENTS = {
  SessionStart: 'session-start',
  PreToolUse: 'pre-tool-use',
  PostToolUse: 'post-tool-use',
  UserPromptSubmit: 'user-prompt-submit',
  Stop: 'stop',
} as const;

function writeReleaseFixture(projectDirectory: string, version: string): void {
  const cliDirectory = nodePath.join(projectDirectory, 'packages', 'cli');
  const pluginDirectory = nodePath.join(cliDirectory, 'codex-plugin', '.codex-plugin');
  const hooks: Record<string, { hooks: { command: string }[] }[]> = {};
  mkdirSync(pluginDirectory, { recursive: true });
  mkdirSync(nodePath.join(projectDirectory, '.claude-plugin'), { recursive: true });
  mkdirSync(nodePath.join(projectDirectory, '.agents', 'plugins'), { recursive: true });

  for (const [manifestEvent, cliEvent] of Object.entries(CODEX_EVENTS)) {
    hooks[manifestEvent] = [
      {
        hooks: [
          {
            command: `bun "\${PLUGIN_ROOT}/runtime/cli.js" hook codex ${cliEvent} --plugin-hook`,
          },
        ],
      },
    ];
  }

  writeFileSync(nodePath.join(cliDirectory, 'package.json'), JSON.stringify({ version }));
  writeFileSync(
    nodePath.join(projectDirectory, '.claude-plugin', 'marketplace.json'),
    JSON.stringify({ plugins: [{ version }] }),
  );
  writeFileSync(
    nodePath.join(projectDirectory, '.agents', 'plugins', 'marketplace.json'),
    JSON.stringify({ name: 'safeword', plugins: [{ name: 'safeword' }] }),
  );
  writeFileSync(nodePath.join(pluginDirectory, 'plugin.json'), JSON.stringify({ version }));
  writeFileSync(
    nodePath.join(cliDirectory, 'codex-plugin', 'package.json'),
    JSON.stringify({ version }),
  );
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

  it('accepts matching release manifests and bundled Codex hook commands', () => {
    writeReleaseFixture(projectDirectory, '1.2.3');

    expect(runGuard(projectDirectory).exitCode).toBe(0);
  });

  it('rejects a Codex hook command that bypasses the bundled runtime', () => {
    writeReleaseFixture(projectDirectory, '1.2.3');
    const hooksPath = nodePath.join(
      projectDirectory,
      'packages',
      'cli',
      'codex-plugin',
      'hooks.json',
    );
    const manifest = JSON.parse(readFileSync(hooksPath, 'utf8')) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>;
    };
    manifest.hooks.Stop = [
      {
        hooks: [{ command: 'bunx --bun safeword@1.2.3 hook codex stop --plugin-hook' }],
      },
    ];
    writeFileSync(hooksPath, JSON.stringify(manifest));

    const result = runGuard(projectDirectory);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('hooks.json');
    expect(result.stderr).toContain('bundled CLI');
  });

  it('rejects bundled hook commands registered under the wrong events', () => {
    writeReleaseFixture(projectDirectory, '1.2.3');
    const hooksPath = nodePath.join(
      projectDirectory,
      'packages',
      'cli',
      'codex-plugin',
      'hooks.json',
    );
    const manifest = JSON.parse(readFileSync(hooksPath, 'utf8')) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>;
    };
    const sessionStartHooks = manifest.hooks.SessionStart;
    const stopHooks = manifest.hooks.Stop;
    if (sessionStartHooks === undefined || stopHooks === undefined) {
      throw new Error('fixture must define SessionStart and Stop hooks');
    }
    manifest.hooks.SessionStart = stopHooks;
    manifest.hooks.Stop = sessionStartHooks;
    writeFileSync(hooksPath, JSON.stringify(manifest));

    const result = runGuard(projectDirectory);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('SessionStart');
  });

  it('rejects a stale bundled runtime package identity', () => {
    writeReleaseFixture(projectDirectory, '1.2.3');
    writeFileSync(
      nodePath.join(projectDirectory, 'packages', 'cli', 'codex-plugin', 'package.json'),
      JSON.stringify({ version: '1.2.2' }),
    );

    const result = runGuard(projectDirectory);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('codex-runtime=1.2.2');
  });

  it('rejects marketplace identities that disagree with generated cache paths', () => {
    writeReleaseFixture(projectDirectory, '1.2.3');
    writeFileSync(
      nodePath.join(projectDirectory, '.agents', 'plugins', 'marketplace.json'),
      JSON.stringify({ name: 'renamed', plugins: [{ name: 'safeword' }] }),
    );

    const result = runGuard(projectDirectory);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('marketplace identity mismatch');
  });
});
