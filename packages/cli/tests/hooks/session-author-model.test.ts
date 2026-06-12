/**
 * Integration: SessionStart author-model capture (ticket MR5M3A).
 *
 * Stop hooks receive no model field (Claude Code docs), so the architecture
 * cross-model gate reads SAFEWORD_AUTHOR_MODEL from the environment. This hook
 * captures the SessionStart `model` stdin field and persists it via
 * CLAUDE_ENV_FILE — the documented forward-pass path.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HOOK = nodePath.join(
  process.cwd(),
  '..',
  '..',
  '.safeword',
  'hooks',
  'session-author-model.ts',
);

let dir: string;
let envFile: string;

beforeEach(() => {
  dir = mkdtempSync(nodePath.join(tmpdir(), 'sw-author-model-'));
  envFile = nodePath.join(dir, 'env');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function run(stdin: object, env: Record<string, string>): void {
  spawnSync('bun', [HOOK], {
    input: JSON.stringify(stdin),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

describe('session-author-model capture', () => {
  it('writes SAFEWORD_AUTHOR_MODEL from the SessionStart model field', () => {
    run(
      { model: 'claude-opus-4-8', hook_event_name: 'SessionStart' },
      { CLAUDE_ENV_FILE: envFile },
    );
    expect(readFileSync(envFile, 'utf8')).toContain('SAFEWORD_AUTHOR_MODEL=claude-opus-4-8');
  });

  it('writes nothing when no model field is present', () => {
    run({ hook_event_name: 'SessionStart' }, { CLAUDE_ENV_FILE: envFile });
    expect(
      existsSync(envFile) && readFileSync(envFile, 'utf8').includes('SAFEWORD_AUTHOR_MODEL'),
    ).toBe(false);
  });

  it('does nothing when CLAUDE_ENV_FILE is unset', () => {
    // No throw, no file — just a clean exit.
    run({ model: 'claude-opus-4-8' }, {});
    expect(existsSync(envFile)).toBe(false);
  });
});
