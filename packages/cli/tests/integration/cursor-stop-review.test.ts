/**
 * Integration tests for Cursor's stop-hook quality review surface.
 *
 * Cursor Stop cannot block, so the observable behavior is whether the hook emits
 * a `followup_message`. Automated evidence phases suppress that generic
 * follow-up while preserving review nudges elsewhere.
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  writeTestFile,
} from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const CURSOR_POST_TOOL = nodePath.join(
  SAFEWORD_ROOT,
  '.safeword/hooks/cursor/post-tool-quality.ts',
);
const CURSOR_STOP = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/cursor/stop.ts');
const TEMPLATE_CURSOR_STOP = nodePath.join(
  SAFEWORD_ROOT,
  'packages/cli/templates/hooks/cursor/stop.ts',
);
const CONVERSATION_ID = 'conv-quiet-implement';
const MARKER_FILE = `/tmp/safeword-cursor-edited-cursor-${CONVERSATION_ID}`;

function buildProject(phase: string): string {
  const cwd = createTemporaryDirectory();
  initGitRepo(cwd);
  writeTestFile(cwd, '.safeword/.gitkeep', '');
  writeTestFile(
    cwd,
    '.safeword-project/tickets/JENFZX-demo/ticket.md',
    ['---', 'id: JENFZX', 'status: in_progress', 'type: task', `phase: ${phase}`, '---'].join('\n'),
  );
  execSync('git add . && git commit -qm base', { cwd, stdio: 'pipe' });
  bindActiveTicketThroughCursorPostTool(cwd);
  return cwd;
}

function bindActiveTicketThroughCursorPostTool(cwd: string): void {
  const stateFile = nodePath.join(
    cwd,
    '.safeword-project/quality-state-cursor-conv-quiet-implement.json',
  );
  const ticketPath = nodePath.join(cwd, '.safeword-project/tickets/JENFZX-demo/ticket.md');

  const result = spawnSync('bun', [CURSOR_POST_TOOL], {
    input: JSON.stringify({
      workspace_roots: [cwd],
      conversation_id: CONVERSATION_ID,
      tool_name: 'Write',
      tool_input: { file_path: ticketPath },
    }),
    cwd,
    encoding: 'utf8',
    timeout: 20_000,
  });

  expect(result.status).toBe(0);
  expect(existsSync(stateFile)).toBe(true);
}

function runCursorStop(cwd: string): { stdout: string; status: number | null } {
  writeFileSync(MARKER_FILE, '');
  const result = spawnSync('bun', [CURSOR_STOP], {
    input: JSON.stringify({
      workspace_roots: [cwd],
      conversation_id: CONVERSATION_ID,
      generation_id: 'gen-1',
      status: 'completed',
    }),
    cwd,
    env: { ...process.env, SAFEWORD_AGENT_RUNTIME: 'cursor' },
    encoding: 'utf8',
    timeout: 20_000,
  });
  return { stdout: (result.stdout ?? '').trim(), status: result.status };
}

describe('Cursor stop review surface', () => {
  let cwd = '';

  afterEach(() => {
    rmSync(MARKER_FILE, { force: true });
    if (cwd) removeTemporaryDirectory(cwd);
    cwd = '';
  });

  it('does not emit a generic follow-up for ordinary implement-phase edits (JENFZX)', () => {
    cwd = buildProject('implement');

    const result = runCursorStop(cwd);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({});
  });

  it('does not emit a generic follow-up before verify has run', () => {
    cwd = buildProject('verify');

    const result = runCursorStop(cwd);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({});
  });

  it('still emits the generic follow-up outside implement phase', () => {
    cwd = buildProject('scenario-gate');

    const result = runCursorStop(cwd);
    const parsed = JSON.parse(result.stdout) as { followup_message?: string };

    expect(result.status).toBe(0);
    expect(parsed.followup_message).toContain('Phase: implement');
  });

  it('keeps crash capture wired in both Cursor stop hook copies', () => {
    for (const hookPath of [CURSOR_STOP, TEMPLATE_CURSOR_STOP]) {
      const content = readFileSync(hookPath, 'utf8');

      expect(content).toContain("import { installCrashCapture } from '../lib/self-report.ts';");
      expect(content).toContain("installCrashCapture('cursor-stop', undefined, 'cursor');");
    }
  });
});
