/**
 * Integration tests for the Codex PostToolUse quality-state adapter (#630).
 * Spawns the real codex/post-tool-quality.ts with Codex-shaped payloads and
 * asserts it writes the codex-scoped per-session quality state (active ticket
 * binding) via the Claude accumulator — the state the PreToolUse gates and
 * write-review-stamp.ts read back.
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, initGitRepo, writeTestFile } from '../helpers.js';

const ADAPTER_PATH = nodePath.resolve(
  __dirname,
  '../../templates/hooks/codex/post-tool-quality.ts',
);
const TICKET_FOLDER = '.safeword-project/tickets/ABC123';

interface CodexPayload {
  session_id?: string;
  tool_name?: string;
  tool_input?: { command?: string; file_path?: string };
}

function project(): string {
  const dir = createTemporaryDirectory();
  initGitRepo(dir);
  writeTestFile(
    dir,
    `${TICKET_FOLDER}/ticket.md`,
    '---\nid: ABC123\ntype: feature\nphase: define-behavior\nstatus: in_progress\n---\n',
  );
  writeTestFile(dir, `${TICKET_FOLDER}/spec.md`, '# Spec\n');
  execSync('git add . && git commit -qm fixture', { cwd: dir, stdio: 'pipe' });
  return dir;
}

function runAdapter(cwd: string, payload: CodexPayload): void {
  const result = spawnSync('bun', [ADAPTER_PATH], {
    input: JSON.stringify(payload),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 20_000,
  });
  expect(result.status).toBe(0);
}

function readBinding(cwd: string, sessionId: string): string | undefined {
  const stateFile = nodePath.join(
    cwd,
    '.safeword-project',
    `quality-state-codex-${sessionId}.json`,
  );
  if (!existsSync(stateFile)) return undefined;
  return (
    (JSON.parse(readFileSync(stateFile, 'utf8')) as { activeTicket: string | null }).activeTicket ??
    undefined
  );
}

describe('Codex PostToolUse quality-state adapter (#630)', () => {
  it('writes the codex-scoped session binding on a direct Edit of a ticket artifact', () => {
    const cwd = project();

    runAdapter(cwd, {
      session_id: 'sess-9',
      tool_name: 'Edit',
      tool_input: { file_path: nodePath.join(cwd, TICKET_FOLDER, 'spec.md') },
    });

    expect(readBinding(cwd, 'sess-9')).toBe('ABC123');
  });

  it('binds from an apply_patch Update whose target is a ticket artifact', () => {
    const cwd = project();
    const patch = [
      '*** Begin Patch',
      `*** Update File: ${nodePath.join(cwd, TICKET_FOLDER, 'spec.md')}`,
      '@@',
      '-# Spec',
      '+# Spec (edited)',
      '*** End Patch',
    ].join('\n');

    runAdapter(cwd, {
      session_id: 'sess-9',
      tool_name: 'apply_patch',
      tool_input: { command: patch },
    });

    expect(readBinding(cwd, 'sess-9')).toBe('ABC123');
  });

  it('ignores unknown tools without writing state', () => {
    const cwd = project();

    runAdapter(cwd, { session_id: 'sess-9', tool_name: 'Read', tool_input: {} });

    expect(readBinding(cwd, 'sess-9')).toBeUndefined();
  });
});
