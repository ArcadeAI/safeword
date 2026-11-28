import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it('pauses a feature for a ticketless patch and restores the gate in the same conversation', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'feature-session-'));
  roots.push(root);
  expect(spawnSync('git', ['init', '--quiet'], { cwd: root }).status).toBe(0);
  const nested = path.join(root, 'app');
  mkdirSync(nested);
  const ticket = path.join(root, '.project/tickets/FTR123-delivery');
  mkdirSync(ticket, { recursive: true });
  mkdirSync(path.join(root, '.safeword'));
  writeFileSync(path.join(root, '.safeword/enrolled'), '');
  writeFileSync(
    path.join(ticket, 'ticket.md'),
    '---\nid: FTR123\nstatus: in_progress\ntype: feature\nphase: intake\n---\n',
  );
  for (const session of ['author', 'peer']) {
    writeFileSync(
      path.join(root, '.project', `quality-state-${session}.json`),
      JSON.stringify({ activeTicket: 'FTR123' }),
    );
  }
  const gate = (session: string, file = 'application.py') => {
    const result = spawnSync(
      'bun',
      [path.resolve(import.meta.dirname, '../../templates/hooks/pre-tool-quality.ts')],
      {
        cwd: root,
        env: { ...process.env, CLAUDE_PROJECT_DIR: root, SAFEWORD_AGENT_RUNTIME: 'claude' },
        encoding: 'utf8',
        input: JSON.stringify({
          session_id: session,
          cwd: root,
          tool_name: 'Write',
          tool_input: { file_path: path.join(root, file), content: 'fixed typo' },
        }),
      },
    );
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout || '{}').hookSpecificOutput?.permissionDecisionReason;
  };
  const switchWork = (action: string) => {
    const result = spawnSync(
      'bun',
      [
        path.resolve(import.meta.dirname, '../../dist/cli.js'),
        'ticket',
        action,
        'FTR123',
        'author',
        '--cwd',
        nested,
        '--json',
      ],
      { cwd: root, encoding: 'utf8' },
    );
    expect(result.status, result.stderr || result.stdout).toBe(0);
  };
  expect(gate('author')).toContain('intake');
  expect(gate('author', '..config')).toContain('intake');
  expect(gate('unbound')).toBeUndefined();
  expect(gate('author', '.project/tickets/FTR123-delivery/dimensions.md')).toBeUndefined();
  switchWork('pause');
  switchWork('pause');
  expect(gate('author')).toBeUndefined();
  expect(gate('peer')).toContain('intake');
  switchWork('resume');
  switchWork('resume');
  expect(gate('author')).toContain('intake');
});
