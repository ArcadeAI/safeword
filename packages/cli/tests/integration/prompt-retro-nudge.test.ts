/**
 * Integration test: the UserPromptSubmit cloud-filing nudge hook (BNGK9W / #568).
 *
 * When the async Stop hook spooled unfiled drafts (REST 401 in cloud), the NEXT
 * user prompt surfaces ONE factual line so the live agent files them via MCP. When
 * the spool holds no unfiled drafts, the boundary stays silent.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { spoolDrafts } from '../../templates/hooks/lib/retro-draft-spool.js';
import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const PROMPT_RETRO_NUDGE = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/prompt-retro-nudge.ts');

const draft = (signature: string, title: string) => ({
  signature,
  title,
  body: `body for ${title}\n<!-- safeword-retro-signature: ${signature} -->`,
  labels: ['self-report', 'retro', 'rough-edge'],
});

function runNudgeHook(directory: string, sessionId: string) {
  return spawnSync('bun', [PROMPT_RETRO_NUDGE], {
    input: JSON.stringify({ session_id: sessionId, prompt: 'do the thing' }),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('prompt-retro-nudge hook (BNGK9W — surface unfiled drafts once per batch)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
    mkdirSync(nodePath.join(projectDirectory, '.git'), { recursive: true });
  });
  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('surfaces exactly one factual line when unfiled drafts are spooled', () => {
    spoolDrafts(projectDirectory, 'sess-1', [
      draft('retro:aaaaaaaaaaaa', 'Alpha'),
      draft('retro:bbbbbbbbbbbb', 'Beta'),
    ]);
    const result = runNudgeHook(projectDirectory, 'sess-1');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('additionalContext');
    expect(result.stdout).toContain('2'); // count of unfiled drafts
    expect(result.stdout).toContain('.safeword/retro-drafts'); // where they are
  });

  it('stays silent when the spool holds no unfiled drafts', () => {
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    const result = runNudgeHook(projectDirectory, 'sess-1');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('nudges once per batch — a second prompt over the same unfiled set is silent', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa', 'Alpha')]);
    const first = runNudgeHook(projectDirectory, 'sess-1');
    expect(first.stdout).toContain('additionalContext');
    const second = runNudgeHook(projectDirectory, 'sess-1');
    expect(second.stdout.trim()).toBe('');
  });
});
