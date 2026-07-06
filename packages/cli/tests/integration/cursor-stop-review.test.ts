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

import { architectureDocumentNudgeText } from '../../templates/hooks/lib/architecture-document-nudge.js';
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

function generatedArchitectureDocument(fingerprint: string): string {
  return `---\ngenerator: safeword-architecture\nfingerprint: ${fingerprint}\n---\n\n# Architecture\n`;
}

function moveArchitectureFingerprint(cwd: string): void {
  const baseBranch = execSync('git branch --show-current', { cwd, encoding: 'utf8' }).trim();
  execSync('git checkout -q -b feature-architecture-drift', { cwd, stdio: 'pipe' });
  execSync(`git branch --set-upstream-to=${baseBranch} feature-architecture-drift`, {
    cwd,
    stdio: 'pipe',
  });
  writeTestFile(
    cwd,
    '.safeword-project/architecture.generated.md',
    generatedArchitectureDocument('moved-fp'),
  );
}

function buildProject(phase: string, options: { architectureDrift?: boolean } = {}): string {
  const cwd = createTemporaryDirectory();
  initGitRepo(cwd);
  writeTestFile(cwd, '.safeword/.gitkeep', '');
  writeTestFile(cwd, 'ARCHITECTURE.md', '# Architecture\n\nHuman narrative.\n');
  writeTestFile(
    cwd,
    '.safeword-project/architecture.generated.md',
    generatedArchitectureDocument('base-fp'),
  );
  writeTestFile(
    cwd,
    '.safeword-project/tickets/JENFZX-demo/ticket.md',
    ['---', 'id: JENFZX', 'status: in_progress', 'type: task', `phase: ${phase}`, '---'].join('\n'),
  );
  execSync('git add . && git commit -qm base', { cwd, stdio: 'pipe' });
  if (options.architectureDrift === true) moveArchitectureFingerprint(cwd);
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

  it('does not emit the architecture drift nudge during implement-phase work', () => {
    cwd = buildProject('implement', { architectureDrift: true });

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

  it('includes the architecture drift nudge for done-phase work when the fingerprint moved', () => {
    cwd = buildProject('done', { architectureDrift: true });

    const result = runCursorStop(cwd);
    const parsed = JSON.parse(result.stdout) as { followup_message?: string };

    expect(result.status).toBe(0);
    expect(parsed.followup_message).toContain(architectureDocumentNudgeText('ARCHITECTURE.md'));
  });

  it('keeps crash capture wired in both Cursor stop hook copies', () => {
    for (const hookPath of [CURSOR_STOP, TEMPLATE_CURSOR_STOP]) {
      const content = readFileSync(hookPath, 'utf8');

      // installCrashCapture must be imported from self-report (co-imports allowed)
      // and invoked — assert the wiring, not a brittle exact import string.
      expect(content).toMatch(
        /import \{[^}]*\binstallCrashCapture\b[^}]*\} from '\.\.\/lib\/self-report\.ts';/,
      );
      expect(content).toContain("installCrashCapture('cursor-stop', undefined, 'cursor');");
    }
  });
});
