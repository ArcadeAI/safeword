import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const STOP_QUALITY = nodePath.join(REPO_ROOT, '.safeword/hooks/stop-quality.ts');

interface ReplyFormatState {
  projectDirectory: string;
  reply: string;
}

const states = new WeakMap<SafewordWorld, ReplyFormatState>();

function buildStopProject(): string {
  const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-reply-format-'));
  mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
  mkdirSync(nodePath.join(projectDirectory, '.project/tickets/099-reply-format'), {
    recursive: true,
  });
  writeFileSync(nodePath.join(projectDirectory, '.safeword/.gitkeep'), '');
  writeFileSync(
    nodePath.join(projectDirectory, '.project/tickets/099-reply-format/ticket.md'),
    ['---', 'id: 099', 'status: in_progress', 'type: task', 'phase: define-behavior', '---'].join(
      '\n',
    ),
  );
  writeFileSync(
    nodePath.join(projectDirectory, '.project/quality-state-reply-format.json'),
    JSON.stringify({ activeTicket: '099', recentFailures: [], incrementedPatterns: [] }),
  );
  writeFileSync(
    nodePath.join(projectDirectory, 'transcript.jsonl'),
    JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Edit', id: 'toolu_reply_format' }] },
    }),
  );
  execFileSync('git', ['init', '-q'], { cwd: projectDirectory });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectDirectory });
  execFileSync('git', ['config', 'user.name', 'Safeword Test'], { cwd: projectDirectory });
  execFileSync('git', ['add', '.'], { cwd: projectDirectory });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: projectDirectory });
  return projectDirectory;
}

After(function (this: SafewordWorld) {
  const state = states.get(this);
  if (state) rmSync(state.projectDirectory, { recursive: true, force: true });
  states.delete(this);
});

Given('Claude has edited work to report', function (this: SafewordWorld) {
  states.set(this, { projectDirectory: buildStopProject(), reply: '' });
});

Given(
  'its final reply contains one CONFIDENT verdict with Decided, Open, and Next paragraphs',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state, 'reply-format fixture was not created');
    state.reply = [
      '**CONFIDENT** — The change is complete.',
      '',
      '**Decided:** Keep the implementation focused.',
      '',
      '**Open:** none.',
      '',
      '**Next:** Review the result.',
    ].join('\n');
  },
);

Given(
  'its final reply contains one BLOCKED verdict with Tried and Need paragraphs',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state, 'reply-format fixture was not created');
    state.reply = [
      '**BLOCKED** — Which release target should I use?',
      '',
      '**Tried:** Checked the ticket and release configuration.',
      '',
      '**Need:** Choose the intended release target.',
    ].join('\n');
  },
);

Given('the reply has no separate Next paragraph', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state, 'reply-format fixture was not created');
  assert.ok(!state.reply.includes('**Next:**'));
});

When('the reply reaches the Stop hook', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state, 'reply-format fixture was not created');
  const result = spawnSync('bun', [STOP_QUALITY], {
    cwd: state.projectDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: state.projectDirectory },
    input: JSON.stringify({
      session_id: 'reply-format',
      transcript_path: nodePath.join(state.projectDirectory, 'transcript.jsonl'),
      last_assistant_message: state.reply,
      stop_hook_active: false,
    }),
    encoding: 'utf8',
    timeout: 60_000,
  });
  this.result = {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
});

Then('no format-correction continuation is emitted', function (this: SafewordWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr);
  assert.equal(this.result.stdout.trim(), '');
});
