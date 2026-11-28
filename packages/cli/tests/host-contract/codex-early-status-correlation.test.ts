import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { createResult } from '../../src/cli-protocol/result.js';
import { startReviewJob } from '../../src/review/job.js';
import {
  authenticatedReviewStatus,
  authenticatedWiringReview,
  reviewJobs,
} from '../helpers/codex-review-authentication.js';
import { seedWiringReview } from '../helpers/codex-review-wiring.js';
import type { NativeTurn } from '../helpers/codex-workflow-observation.js';

const repo = path.resolve(import.meta.dirname, '../../../..');
const roots: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

// Only the external review worker is substituted; the normal coordinator signs
// the job and the installed coordinator re-authenticates the current status.
async function fixture() {
  const temporary = mkdtempSync(path.join(tmpdir(), 'safeword-early-status-'));
  const root = realpathSync(temporary);
  roots.push(root);
  const project = path.join(root, 'project');
  const profile = path.join(root, 'profile');
  mkdirSync(project);
  mkdirSync(profile);
  seedWiringReview(project, 'defective');
  const keyRoot = path.join(profile, 'review-keys');
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', keyRoot);
  const originalState = process.env.XDG_STATE_HOME ?? path.join(homedir(), '.local/state');
  vi.stubEnv('MISE_STATE_DIR', process.env.MISE_STATE_DIR ?? path.join(originalState, 'mise'));
  vi.stubEnv('XDG_STATE_HOME', keyRoot);
  vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');
  const result = createResult({
    state: 'healthy',
    data: {
      command: 'review run',
      status: 'approved',
      author_agent: 'codex',
      actual_reviewer: 'claude',
      reviewer_model: 'opus',
      independence: 'cross-agent',
      confirmed_reviewer_model: { provider: 'anthropic', model: 'claude-opus-5' },
      reviewer_output: {
        schema_version: 1,
        dispatch_id: 'synthetic-worker',
        reviewer_agent: 'claude',
        verdict: 'approve',
        summary: 'boundary control only',
        findings: [],
      },
    },
  });
  const reviewer = path.join(root, 'reviewer.ts');
  const worker = path.join(root, 'worker.mjs');
  writeFileSync(
    reviewer,
    `import {completeReviewJob} from ${JSON.stringify(path.join(repo, 'packages/cli/src/review/job.ts'))};\ncompleteReviewJob(process.cwd(),process.env.SAFEWORD_REVIEW_JOB_ID,${JSON.stringify(result)});`,
  );
  writeFileSync(
    worker,
    `import{spawnSync}from'node:child_process';import{writeFileSync as save}from'node:fs';const r=spawnSync(${JSON.stringify(path.join(repo, 'scripts/dev'))},['bun',${JSON.stringify(reviewer)},...process.argv.slice(2)],{env:process.env,encoding:'utf8'});save(${JSON.stringify(path.join(root, 'worker-result.json'))},JSON.stringify({status:r.status,stdout:r.stdout,stderr:r.stderr}));process.exitCode=r.status??1;`,
  );
  vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker);
  const locations = {
    project,
    profile,
    installed: path.join(repo, 'packages/cli/codex-plugin'),
    artifacts: root,
  };
  const before = reviewJobs(project);
  await startReviewJob({
    cwd: project,
    kind: 'quality-review',
    targets: ['clamp.js', 'clamp.test.js'],
  });
  await expect.poll(() => existsSync(path.join(root, 'worker-result.json'))).toBe(true);
  const status = authenticatedReviewStatus(locations, before);
  expect(status.data).toMatchObject({ status: 'approved', review_kind: 'quality-review' });
  const runtime = path.join(locations.installed, 'runtime/cli.js');
  const command = `SAFEWORD_PLUGIN_RUNTIME='${runtime}'; PROJECT_DIR='${project}'; cd "$PROJECT_DIR" && npm test && node -e "import('./clamp.js').then(x => x.clamp(2,0,1))"; bun "$SAFEWORD_PLUGIN_RUNTIME" review status --json`;
  const output = JSON.stringify(status);
  const turn: NativeTurn = {
    thread: 'synthetic',
    rollout: 'nonreceipt',
    models: [],
    allEntries: [],
    entries: [
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          call_id: 'control',
          input: `const r = await tools.exec_command(${JSON.stringify({ cmd: command, workdir: project })}); text(r.output);`,
        },
      },
      {
        type: 'response_item',
        payload: { type: 'custom_tool_call_output', call_id: 'control', output },
      },
    ],
    events: [
      {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: `/bin/zsh -lc '${command.replaceAll("'", "'\"'\"'")}'`,
          exit_code: 0,
          aggregated_output: output,
        },
      },
    ],
  };
  return { locations, before, turn, command };
}

function setCommand(f: Awaited<ReturnType<typeof fixture>>, command: string) {
  const call = f.turn.entries[0]?.payload;
  const item = f.turn.events[0]?.item;
  assert.ok(call);
  assert.ok(item);
  call.input = `const r = await tools.exec_command(${JSON.stringify({ cmd: command, workdir: f.locations.project })}); text(r.output);`;
  item.command = `/bin/zsh -lc '${command.replaceAll("'", "'\"'\"'")}'`;
}

it('correlates the completed current status after early bound cwd and literal preparation', async () => {
  const f = await fixture();
  const early = structuredClone(f.turn);
  const tailCommand = f.command.replace(
    'cd "$PROJECT_DIR" && npm test && node -e "import(\'./clamp.js\').then(x => x.clamp(2,0,1))";',
    'npm test && node -e "import(\'./clamp.js\').then(x => x.clamp(2,0,1))"; cd "$PROJECT_DIR" &&',
  );
  assert.notEqual(tailCommand, f.command);
  setCommand(f, tailCommand);
  expect(authenticatedWiringReview(f.locations, f.before, f.turn).callId).toBe('control');
  let receipt;
  try {
    receipt = authenticatedWiringReview(f.locations, f.before, early);
  } catch (error) {
    throw new Error('EARLY_BOUND_STATUS_UNAVAILABLE', { cause: error });
  }
  expect(receipt.callId).toBe('control');
  expect(receipt.output.verdict).toBe('approve');
}, 20_000);

function injectFault(f: Awaited<ReturnType<typeof fixture>>, fault: string) {
  const first = f.turn.entries[0];
  const second = f.turn.entries[1];
  const event = f.turn.events[0];
  assert.ok(first?.payload);
  assert.ok(second?.payload);
  assert.ok(event?.item);
  const call = first.payload;
  const output = second.payload;
  const item = event.item;
  switch (fault) {
    case 'foreign cwd': {
      call.input = String(call.input).replace(
        JSON.stringify({ cmd: f.command, workdir: f.locations.project }),
        () => JSON.stringify({ cmd: f.command, workdir: '/foreign' }),
      );
      break;
    }
    case 'partial output': {
      output.output = String(output.output).slice(0, -1);
      item.aggregated_output = String(item.aggregated_output).slice(0, -1);
      break;
    }
    case 'foreign call': {
      output.call_id = 'foreign';
      break;
    }
    case 'duplicate call': {
      f.turn.entries.push(structuredClone(first));
      break;
    }
    case 'nonzero exit': {
      item.exit_code = 2;
      break;
    }
    // No default
  }
}

it.each(['foreign cwd', 'partial output', 'foreign call', 'duplicate call', 'nonzero exit'])(
  'refuses a current status with %s',
  async fault => {
    const f = await fixture();
    injectFault(f, fault);
    expect(() => authenticatedWiringReview(f.locations, f.before, f.turn)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
  },
  20_000,
);

it.each([
  ['dynamic binding', (command: string) => command.replace("PROJECT_DIR='", "PROJECT_DIR=$HOME'")],
  ['wrong cd', (command: string) => command.replace('cd "$PROJECT_DIR"', 'cd /foreign')],
  [
    'conditional binding',
    (command: string) => command.replace("'; PROJECT_DIR=", "' && PROJECT_DIR="),
  ],
  ['dynamic preparation', (command: string) => command.replace('npm test', 'npm "$HOME"')],
  [
    'duplicate cd',
    (command: string) => command.replace('npm test', 'cd "$PROJECT_DIR" && npm test'),
  ],
])(
  'refuses an early status with %s',
  async (_name, change) => {
    const f = await fixture();
    const changed = change(f.command);
    expect(changed).not.toBe(f.command);
    setCommand(f, changed);
    expect(() => authenticatedWiringReview(f.locations, f.before, f.turn)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
  },
  20_000,
);

it('does not report preparation success when earlier output records failure', async () => {
  const f = await fixture();
  const output = f.turn.entries[1]?.payload;
  const item = f.turn.events[0]?.item;
  assert.ok(output);
  assert.ok(item);
  const failedOutput = `npm test failed\n${String(output.output)}`;
  output.output = failedOutput;
  item.aggregated_output = failedOutput;
  const receipt = authenticatedWiringReview(f.locations, f.before, f.turn);
  expect(receipt.callId).toBe('control');
  expect(receipt).not.toHaveProperty('preparationSucceeded');
  expect(Object.keys(receipt)).toEqual([
    'callId',
    'reviewId',
    'reviewer',
    'model',
    'provenance',
    'output',
  ]);
}, 20_000);

it('refuses a partial raw output when the SDK output is complete', async () => {
  const f = await fixture();
  const output = f.turn.entries[1]?.payload;
  assert.ok(output);
  output.output = String(output.output).slice(0, -1);
  expect(() => authenticatedWiringReview(f.locations, f.before, f.turn)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
}, 20_000);

it('refuses the early status after a reviewed target changes', async () => {
  const f = await fixture();
  expect(authenticatedWiringReview(f.locations, f.before, f.turn).callId).toBe('control');
  writeFileSync(path.join(f.locations.project, 'clamp.js'), 'changed after review\n');
  expect(() => authenticatedWiringReview(f.locations, f.before, f.turn)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
}, 20_000);

it('refuses a foreign review identity in matching raw and SDK output', async () => {
  const f = await fixture();
  const output = f.turn.entries[1]?.payload;
  const item = f.turn.events[0]?.item;
  assert.ok(output);
  assert.ok(item);
  const foreign = String(output.output).replace(
    /"review_id":"[\da-f-]{36}"/u,
    '"review_id":"00000000-0000-4000-8000-000000000000"',
  );
  expect(foreign).not.toBe(output.output);
  output.output = foreign;
  item.aggregated_output = foreign;
  expect(() => authenticatedWiringReview(f.locations, f.before, f.turn)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
}, 20_000);

it('keeps the early form unavailable for explicit-ID status', async () => {
  const f = await fixture();
  const status = authenticatedReviewStatus(f.locations, f.before);
  const id = (status.data as { review_id: string }).review_id;
  setCommand(
    f,
    f.command.replace('review status --json', () => `review status ${id} --json`),
  );
  expect(() => authenticatedWiringReview(f.locations, f.before, f.turn)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE',
  );
}, 20_000);
