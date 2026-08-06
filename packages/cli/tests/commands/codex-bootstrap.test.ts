/* eslint-disable unicorn/no-null -- Codex observations use null for unavailable version metadata */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { recordCodexHookProof } from '../../src/codex-plugin/profile-proof.js';
import { bootstrapCodexPlugin } from '../../src/commands/codex-bootstrap.js';
import type { observeCodexMigrationResult } from '../../src/commands/migrate-codex-plugin.js';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

function fixture(): { cwd: string; environment: NodeJS.ProcessEnv } {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-bootstrap-'));
  const cwd = nodePath.join(directory, 'project');
  mkdirSync(cwd);
  directories.push(directory);
  return { cwd, environment: { CODEX_HOME: nodePath.join(directory, 'profile') } };
}

function observation(enabled: boolean, version: string | null = null) {
  return {
    plugin: { installed: enabled, enabled, version, observation: 'observed' },
  } as ReturnType<typeof observeCodexMigrationResult>;
}

function context(result: ReturnType<typeof bootstrapCodexPlugin>): string {
  const body = result.presentation?.body ?? '';
  if (body === '') return '';
  const output = JSON.parse(body) as {
    hookSpecificOutput: { additionalContext: string };
  };
  return output.hookSpecificOutput.additionalContext;
}

describe('Codex project bootstrap', () => {
  it('is silent only when this exact project and task have native SessionStart proof', () => {
    const { cwd, environment } = fixture();
    recordCodexHookProof('session-start', environment, new Date(), {
      projectDirectory: cwd,
      sessionId: 'task-a',
    });
    const observe = vi.fn(() => observation(true));

    const current = bootstrapCodexPlugin(cwd, JSON.stringify({ session_id: 'task-a' }), {
      environment,
      observe,
    });
    const otherTask = bootstrapCodexPlugin(cwd, JSON.stringify({ session_id: 'task-b' }), {
      environment,
      observe,
    });

    expect(current.presentation?.body).toBe('');
    expect(observe).toHaveBeenCalledTimes(1);
    expect(context(otherTask)).toContain('SAFEWORD IS NOT ACTIVE IN THIS TASK');
  });

  it('installs a missing profile plugin but warns that this task remains unprotected', () => {
    const { cwd, environment } = fixture();
    const install = vi.fn();

    const result = bootstrapCodexPlugin(cwd, JSON.stringify({ session_id: 'task-a' }), {
      environment,
      observe: () => observation(false),
      install,
    });

    expect(result.state).toBe('changed');
    expect(install).toHaveBeenCalledOnce();
    expect(context(result)).toContain('Safeword is installed for your Codex profile');
    expect(context(result)).toContain('You can continue working');
  });

  it('turns installation failure into one loud non-blocking advisory and one retry command', () => {
    const { cwd, environment } = fixture();
    const result = bootstrapCodexPlugin(cwd, JSON.stringify({ session_id: 'task-a' }), {
      environment,
      observe: () => observation(false),
      install: () => {
        throw new Error('marketplace unavailable; retry `safeword codex install`');
      },
    });
    const message = context(result);

    expect(result.state).toBe('healthy');
    expect(result.changed).toBe(false);
    expect(message).toContain('Automatic profile installation failed: marketplace unavailable');
    expect(message).toContain('You can continue working');
    expect(message.match(/bunx --bun safeword@latest codex install/gu)).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it('does not attempt network installation in offline mode', () => {
    const { cwd, environment } = fixture();
    const install = vi.fn();

    const result = bootstrapCodexPlugin(cwd, '{}', {
      environment,
      offline: true,
      observe: () => observation(false),
      install,
    });

    expect(install).not.toHaveBeenCalled();
    expect(result.state).toBe('healthy');
    expect(context(result)).toContain('installation was skipped because Codex is offline');
  });
});
