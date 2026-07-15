import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  normalizeNamespaceRootLabel,
  packagedNamespaceRootLabel,
} from '../../src/commands/codex-hook.js';

describe('packagedNamespaceRootLabel', () => {
  const directories: string[] = [];
  const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');

  afterEach(() => {
    for (const directory of directories) {
      rmSync(directory, { recursive: true, force: true });
    }
    directories.length = 0;
  });

  it('includes a custom project root in the generated ownership module', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot: 'knowledge' } }),
    );

    expect(packagedNamespaceRootLabel(projectDirectory)).toBe('knowledge');
  });

  it('normalizes Windows custom roots for Git-owned path matching', () => {
    expect(normalizeNamespaceRootLabel(String.raw`knowledge\docs`)).toBe('knowledge/docs');
  });

  it('stages an auto-upgrade change under a custom namespace through SessionStart', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    const run = (command: string, args: string[]) =>
      spawnSync(command, args, { cwd: projectDirectory, encoding: 'utf8' });
    expect(run('git', ['init', '-q']).status).toBe(0);
    expect(run('git', ['config', 'user.email', 'test@example.com']).status).toBe(0);
    expect(run('git', ['config', 'user.name', 'Test User']).status).toBe(0);
    writeFileSync(nodePath.join(projectDirectory, 'README.md'), '# fixture\n');
    expect(run('git', ['add', 'README.md']).status).toBe(0);
    expect(run('git', ['commit', '-qm', 'initial']).status).toBe(0);

    const safewordDirectory = nodePath.join(projectDirectory, '.safeword');
    mkdirSync(safewordDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(safewordDirectory, 'config.json'),
      JSON.stringify({ paths: { projectRoot: 'knowledge' } }),
    );
    writeFileSync(nodePath.join(safewordDirectory, 'version'), '1.0.0\n');
    writeFileSync(
      nodePath.join(safewordDirectory, '.update-cache.json'),
      JSON.stringify({
        latestVersion: '1.0.1',
        publishedAt: Date.now() - 24 * 60 * 60 * 1000,
        checkedAt: Date.now(),
      }),
    );
    writeFileSync(nodePath.join(safewordDirectory, 'SAFEWORD.md'), '# context\n');
    expect(run('git', ['add', '.safeword']).status).toBe(0);
    expect(run('git', ['commit', '-qm', 'configure safeword']).status).toBe(0);

    const binDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-bin-'));
    directories.push(binDirectory);
    const bunxPath = nodePath.join(binDirectory, 'bunx');
    writeFileSync(
      bunxPath,
      '#!/bin/sh\nmkdir -p knowledge\nprintf "upgraded\\n" > knowledge/UPGRADE.md\n',
    );
    chmodSync(bunxPath, 0o755);

    const result = spawnSync(process.execPath, [CLI_PATH, 'hook', 'codex', 'session-start'], {
      cwd: projectDirectory,
      input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: projectDirectory }),
      encoding: 'utf8',
      env: {
        ...process.env,
        CI: '',
        SAFEWORD_NO_AUTO_UPGRADE: '',
        PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
      },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(run('git', ['show', '--format=', '--name-only', 'HEAD']).stdout).toContain(
      'knowledge/UPGRADE.md',
    );
  });

  it('injects package-owned SessionStart instructions instead of project-local text', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword', 'SAFEWORD.md'),
      'PROJECT-LOCAL INSTRUCTIONS MUST NOT APPEAR',
    );

    const result = spawnSync(process.execPath, [CLI_PATH, 'hook', 'codex', 'session-start'], {
      cwd: projectDirectory,
      input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: projectDirectory }),
      encoding: 'utf8',
      env: { ...process.env, SAFEWORD_NO_AUTO_UPGRADE: '1' },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('SAFEWORD Agent Instructions');
    expect(result.stdout).not.toContain('PROJECT-LOCAL INSTRUCTIONS MUST NOT APPEAR');
  });

  it('propagates an exit-code denial from the packaged PreToolUse adapter', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);

    const result = spawnSync(process.execPath, [CLI_PATH, 'hook', 'codex', 'pre-tool-use'], {
      cwd: projectDirectory,
      input: JSON.stringify({
        session_id: 'deny-session',
        tool_name: 'Bash',
        tool_input: { command: 'pkill node' },
      }),
      encoding: 'utf8',
      env: { ...process.env, SAFEWORD_CODEX_DENY_MODE: 'exit-code' },
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Broad process kill blocked');
  });

  it('fails PreToolUse visibly when Bun is unavailable', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);

    const result = spawnSync(process.execPath, [CLI_PATH, 'hook', 'codex', 'pre-tool-use'], {
      cwd: projectDirectory,
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo allowed' } }),
      encoding: 'utf8',
      env: { ...process.env, PATH: '' },
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('bun');
  });

  it('reports an unknown event without blocking the Codex hook process', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);

    const result = spawnSync(process.execPath, [CLI_PATH, 'hook', 'codex', 'before-tool-use'], {
      cwd: projectDirectory,
      input: '{}',
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('unknown Codex hook event: before-tool-use');
  });
});
