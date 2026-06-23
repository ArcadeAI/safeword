/**
 * Integration test: the stop-self-report hook surfaces captured signals via
 * hookSpecificOutput.additionalContext (ticket QYYC5Y, issue #345).
 *
 * Spawns the real dogfood hook under bun, with a seeded spool, and asserts it
 * emits a factual additionalContext on exit 0 — and stays silent (no output)
 * when the session captured nothing.
 */

import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { recordSignal } from '../../templates/hooks/lib/self-report.js';
import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HOOK = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-self-report.ts');

function runHook(directory: string, sessionId: string) {
  return spawnSync('bun', [HOOK], {
    input: JSON.stringify({ session_id: sessionId }),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('stop-self-report hook (QYYC5Y)', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('surfaces captured signals as additionalContext on exit 0', () => {
    recordSignal(
      projectDirectory,
      'sess-1',
      { source: 'post-tool-quality', errorClass: 'TypeError' },
      '1.0.0',
    );

    const result = runHook(projectDirectory, 'sess-1');

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('Stop');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Safeword recorded 1');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('TypeError@post-tool-quality');
  });

  it('stays silent (no output) when the session captured nothing', () => {
    const result = runHook(projectDirectory, 'empty-session');

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});
