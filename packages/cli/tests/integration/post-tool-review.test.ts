/**
 * Integration tests for the PostToolUse per-step / per-phase review surface.
 * Spawns the deployed .safeword/hooks/post-tool-quality.ts and asserts it
 * surfaces phase reviews while keeping ordinary implement-step reviews quiet.
 */

import { execSync, spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, initGitRepo, writeTestFile } from '../helpers.js';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const POST_TOOL_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/post-tool-quality.ts');
const TICKET_FOLDER = '.safeword-project/tickets/ABC123-demo';

interface ToolInput {
  file_path?: string;
  old_string?: string;
  new_string?: string;
  content?: string;
}

function project(): string {
  const dir = createTemporaryDirectory();
  initGitRepo(dir);
  writeTestFile(dir, '.safeword-project/.gitkeep', '');
  writeTestFile(dir, 'init.txt', 'init');
  execSync('git add . && git commit -m init', { cwd: dir, stdio: 'pipe' });
  return dir;
}

function run(cwd: string, toolName: string, toolInput: ToolInput, sessionId = 's1') {
  const result = spawnSync('bun', [POST_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: sessionId,
      hook_event_name: 'PostToolUse',
      tool_name: toolName,
      tool_input: toolInput,
    }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: 20_000,
  });
  const out = (result.stdout ?? '').trim();
  const context = out ? JSON.parse(out).hookSpecificOutput?.additionalContext : undefined;
  return { out, context };
}

function ticketPath(cwd: string): string {
  return nodePath.join(cwd, TICKET_FOLDER, 'ticket.md');
}

function writeTicket(cwd: string, phase: string): void {
  writeTestFile(
    cwd,
    `${TICKET_FOLDER}/ticket.md`,
    `---\nid: ABC123\nslug: demo\ntype: feature\nphase: ${phase}\nstatus: in_progress\n---\n\n# Demo\n`,
  );
}

function defsPath(cwd: string): string {
  return nodePath.join(cwd, TICKET_FOLDER, 'test-definitions.md');
}

describe('PostToolUse implement-step review surface (JENFZX)', () => {
  it('surfaces no user-facing review on a RED flip during implement (JENFZX)', () => {
    const cwd = project();
    const { context } = run(cwd, 'Edit', {
      file_path: defsPath(cwd),
      old_string: '- [ ] RED',
      new_string: '- [x] RED abc1234',
    });
    expect(context).toBeUndefined();
  });

  it('surfaces nothing when an edit flips no checkbox (S1.4)', () => {
    const cwd = project();
    const { context } = run(cwd, 'Edit', {
      file_path: defsPath(cwd),
      old_string: 'Given a registered user',
      new_string: 'Given a signed-up user',
    });
    expect(context).toBeUndefined();
  });

  it('keeps RED/GREEN/REFACTOR flips quiet across one turn (JENFZX)', () => {
    const cwd = project();
    const red = run(cwd, 'Edit', {
      file_path: defsPath(cwd),
      old_string: '- [ ] RED',
      new_string: '- [x] RED aaa1111',
    });
    const green = run(cwd, 'Edit', {
      file_path: defsPath(cwd),
      old_string: '- [ ] GREEN',
      new_string: '- [x] GREEN bbb2222',
    });
    const refactor = run(cwd, 'Edit', {
      file_path: defsPath(cwd),
      old_string: '- [ ] REFACTOR',
      new_string: '- [x] REFACTOR ccc3333',
    });
    expect(red.context).toBeUndefined();
    expect(green.context).toBeUndefined();
    expect(refactor.context).toBeUndefined();
  });

  it('keeps batched TDD flips quiet during implement (JENFZX)', () => {
    const cwd = project();
    const { context } = run(cwd, 'Edit', {
      file_path: defsPath(cwd),
      old_string: '- [ ] RED\n- [ ] GREEN',
      new_string: '- [x] RED aaa1111\n- [x] GREEN bbb2222',
    });
    expect(context).toBeUndefined();
  });
});

describe('PostToolUse per-phase review — autonomous-safe (S2.1, S2.2)', () => {
  it('surfaces the entered-phase review on a phase change, with no Stop involved (S2.1)', () => {
    const cwd = project();
    writeTicket(cwd, 'scenario-gate');
    const { context } = run(cwd, 'Edit', {
      file_path: ticketPath(cwd),
      old_string: 'phase: define-behavior',
      new_string: 'phase: scenario-gate',
    });
    expect(context).toBeDefined();
    expect(context).toContain('scenario-gate');
  });

  it('surfaces nothing when the current phase was already reviewed (S2.2)', () => {
    const cwd = project();
    writeTicket(cwd, 'implement');
    // Pre-seed the dedup marker: implement already reviewed this session.
    writeTestFile(
      cwd,
      '.safeword-project/quality-state-s1.json',
      JSON.stringify({
        locSinceCommit: 0,
        lastCommitHash: '',
        activeTicket: 'ABC123',
        gate: undefined,
        locAtLastReview: 0,
        recentFailures: [],
        incrementedPatterns: [],
        lastReviewedPhase: 'implement',
      }),
    );
    const { context } = run(cwd, 'Edit', {
      file_path: ticketPath(cwd),
      old_string: '# Demo',
      new_string: '# Demo (edited)',
    });
    expect(context).toBeUndefined();
  });
});
