import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const STOP_QUALITY = nodePath.join(REPO_ROOT, '.safeword/hooks/stop-quality.ts');

export interface ReplyFormatState {
  projectDirectory: string;
  reply: string;
  stopHookActive: boolean;
}

const states = new WeakMap<SafewordWorld, ReplyFormatState>();

export function setReplyFormatState(world: SafewordWorld, state: ReplyFormatState): void {
  states.set(world, state);
}

export function getReplyFormatState(world: SafewordWorld): ReplyFormatState {
  const state = states.get(world);
  assert.ok(state, 'reply-format fixture was not created');
  return state;
}

export function ensureReplyFormatState(world: SafewordWorld): ReplyFormatState {
  const existing = states.get(world);
  if (existing) return existing;
  const state = {
    projectDirectory: buildReplyFormatProject(),
    reply: '',
    stopHookActive: false,
  };
  states.set(world, state);
  return state;
}

export function buildReplyFormatProject(): string {
  const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-reply-format-'));
  mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
  // The decision-brief reply contract is enforced by the Stop-time review, which
  // is opt-in since KHL52X. These scenarios ARE that contract, so switch it on.
  writeFileSync(
    nodePath.join(projectDirectory, '.safeword', 'config.json'),
    `${JSON.stringify({ stopQualityReview: true }, undefined, 2)}\n`,
  );
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

export function runReplyFormatStop(world: SafewordWorld): void {
  const state = states.get(world);
  assert.ok(state, 'reply-format fixture was not created');
  const result = spawnSync('bun', [STOP_QUALITY], {
    cwd: state.projectDirectory,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: state.projectDirectory,
      SAFEWORD_CLI: nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts'),
    },
    input: JSON.stringify({
      session_id: 'reply-format',
      transcript_path: nodePath.join(state.projectDirectory, 'transcript.jsonl'),
      last_assistant_message: state.reply,
      stop_hook_active: state.stopHookActive,
    }),
    encoding: 'utf8',
    timeout: 60_000,
  });
  world.result = {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

function assertNoCorrection(world: SafewordWorld): void {
  assert.equal(world.result.exitCode, 0, world.result.stderr);
  assert.equal(world.result.stdout.trim(), '');
}

function correctionReason(world: SafewordWorld): string {
  assert.equal(world.result.exitCode, 0, world.result.stderr);
  const output = JSON.parse(world.result.stdout) as { decision?: string; reason?: string };
  assert.equal(output.decision, 'block');
  return output.reason ?? '';
}

function assertConfidentCorrection(world: SafewordWorld): void {
  const reason = correctionReason(world);
  assert.match(reason, /\*\*CONFIDENT\*\*[\s\S]*\*\*Next:\*\*/u);
  assert.doesNotMatch(reason, /\*\*BLOCKED\*\*/u);
}

function assertVerdictChoiceCorrection(world: SafewordWorld): void {
  assert.match(correctionReason(world), /\*\*CONFIDENT\*\*[\s\S]*\*\*BLOCKED\*\*/u);
}

After(function (this: SafewordWorld) {
  const state = states.get(this);
  if (state) rmSync(state.projectDirectory, { recursive: true, force: true });
  states.delete(this);
});

Given('Claude has edited work to report', function (this: SafewordWorld) {
  states.set(this, {
    projectDirectory: buildReplyFormatProject(),
    reply: '',
    stopHookActive: false,
  });
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

Given('its final reply has no terminal verdict', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state, 'reply-format fixture was not created');
  state.reply = 'Implemented the requested change and verified the focused test.';
});

Given('no Stop correction is active', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state, 'reply-format fixture was not created');
  state.stopHookActive = false;
});

Given('its correction reply is still structurally incomplete', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state, 'reply-format fixture was not created');
  state.reply = '**CONFIDENT** — Done.';
});

Given('a Stop correction is already active', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state, 'reply-format fixture was not created');
  state.stopHookActive = true;
});

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

Given(
  'its final reply declares CONFIDENT without an Open paragraph',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state, 'reply-format fixture was not created');
    state.reply = [
      '**CONFIDENT** — The change is complete.',
      '',
      '**Decided:** Keep the implementation focused.',
      '',
      '**Next:** Review the result.',
    ].join('\n');
  },
);

When('the reply reaches the Stop hook', function (this: SafewordWorld) {
  runReplyFormatStop(this);
});

When('the correction reply reaches the Stop hook', function (this: SafewordWorld) {
  runReplyFormatStop(this);
});

Then('no format-correction continuation is emitted', function (this: SafewordWorld) {
  assertNoCorrection(this);
});

Then('the canonical format correction is emitted', function (this: SafewordWorld) {
  assertConfidentCorrection(this);
});

Then('exactly one canonical format correction is emitted', function (this: SafewordWorld) {
  assert.equal(this.result.stdout.trim().split('\n').length, 1);
  assertVerdictChoiceCorrection(this);
});

Then('no further format-correction continuation is emitted', function (this: SafewordWorld) {
  assertNoCorrection(this);
});
