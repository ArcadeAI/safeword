import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { createResult } from '../../src/cli-protocol/result.js';
import { startReviewJob } from '../../src/review/job.js';
import { readCommands } from '../helpers/codex-literal-root-read.js';
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

function setBoundary(f: Awaited<ReturnType<typeof fixture>>, boundCwd: boolean, mixed: boolean) {
  const runtime = path.join(f.locations.installed, 'runtime/cli.js');
  const project = f.locations.project;
  const cwd = boundCwd ? ' --cwd "$PROJECT_DIR"' : '';
  const command = `SAFEWORD_PLUGIN_RUNTIME='${runtime}'; PROJECT_DIR='${project}'; SAFEWORD_REVIEW_PROGRESS=1 bun "$SAFEWORD_PLUGIN_RUNTIME" review run quality-review${cwd} --context package.json --agent-handoff --json -- clamp.js clamp.test.js`;
  const request = JSON.stringify({ cmd: command, workdir: project });
  const call = f.turn.entries[0]?.payload;
  const item = f.turn.events[0]?.item;
  assert.ok(call);
  assert.ok(item);
  call.input = mixed
    ? `const results = await Promise.all([tools.web__run({"open":[{"ref_id":"https://example.com"}]}), tools.exec_command(${request})]); text(results[0]); text(results[1].output);`
    : `const r = await tools.exec_command(${request}); text(r.output);`;
  item.command = `/bin/zsh -lc '${command.replaceAll("'", "'\"'\"'")}'`;
  return call;
}

it.each([
  ['bound cwd', true, false],
  ['mixed cell', false, true],
  ['combined', true, true],
])(
  'correlates current signed review for %s',
  async (_name, boundCwd, mixed) => {
    const f = await fixture();
    setBoundary(f, false, false);
    expect(authenticatedWiringReview(f.locations, f.before, f.turn).callId).toBe('control');
    setBoundary(f, boundCwd, mixed);
    let result;
    try {
      result = authenticatedWiringReview(f.locations, f.before, f.turn);
    } catch (error) {
      throw new Error('MIXED_REVIEW_CORRELATION_UNAVAILABLE', { cause: error });
    }
    expect(result.callId).toBe('control');
  },
  20_000,
);

it('correlates the complete exec output after a separate web emission', async () => {
  const f = await fixture();
  setBoundary(f, true, true);
  const output = f.turn.entries[1]?.payload;
  assert.ok(output && typeof output.output === 'string');
  output.output = `{"content":[{"type":"text","text":"web result"}]}\n${output.output}`;
  expect(authenticatedWiringReview(f.locations, f.before, f.turn).callId).toBe('control');
}, 20_000);

it('keeps literal and comment mentions out of mixed-call recognition', () => {
  const input =
    'const r = await tools.exec_command({"cmd":"echo tools.web__run"}); text(r.output); // tools.web__run';
  expect(readCommands(input)).toEqual(['echo tools.web__run']);
});

it.each([
  ['swapped index', (input: string) => input.replace('text(results[0])', 'text(results[1])')],
  [
    'computed index',
    (input: string) => input.replace('results[1].output', 'results[1 + 0].output'),
  ],
  ['extra emission', (input: string) => `${input} text(results[0]);`],
  [
    'extra producer',
    (input: string) => input.replace('tools.web__run(', 'tools.extra(), tools.web__run('),
  ],
  ['mutation', (input: string) => `${input} results[1].output = 'forged';`],
  ['rebinding', (input: string) => input.replace('const results', 'let results')],
  ['foreign producer', (input: string) => input.replace('tools.web__run', 'tools.other')],
  [
    'reversed emissions',
    (input: string) =>
      input.replace(
        'text(results[0]); text(results[1].output);',
        'text(results[1].output); text(results[0]);',
      ),
  ],
  ['dynamic request', (input: string) => input.replace('"open":', 'open:')],
  [
    'foreign command metadata',
    (input: string) => input.replace('"workdir":', '"command":"foreign","workdir":'),
  ],
  ['less specific run', (input: string) => input.replace('--agent-handoff ', '')],
  [
    'foreign binding',
    (input: string, project: string) =>
      input.replace(`PROJECT_DIR='${project}'`, "PROJECT_DIR='/foreign'"),
  ],
  [
    'conditional binding',
    (input: string, project: string) =>
      input.replace(`PROJECT_DIR='${project}'`, () => `true || PROJECT_DIR='${project}'`),
  ],
  [
    'wrong workdir',
    (input: string, project: string) =>
      input.replace(`"workdir":"${project}"`, '"workdir":"/foreign"'),
  ],
])(
  'refuses %s after valid current review setup',
  async (name, alter) => {
    const f = await fixture();
    const call = setBoundary(f, true, true);
    expect(authenticatedWiringReview(f.locations, f.before, f.turn).callId).toBe('control');
    assert.ok(typeof call.input === 'string');
    call.input = alter(call.input, f.locations.project);
    if (['foreign binding', 'conditional binding', 'less specific run'].includes(name)) {
      const shell = readCommands(call.input)[0];
      const item = f.turn.events[0]?.item;
      assert.ok(shell && item);
      item.command = `/bin/zsh -lc '${shell.replaceAll("'", "'\"'\"'")}'`;
    }
    expect(() => authenticatedWiringReview(f.locations, f.before, f.turn)).toThrow(
      /HOST_CONTRACT_PROOF_UNAVAILABLE/,
    );
  },
  20_000,
);

it.each(['partial', 'mismatch', 'duplicate', 'duplicate-call'])(
  'refuses %s raw evidence after valid current review setup',
  async fault => {
    const f = await fixture();
    setBoundary(f, true, true);
    expect(authenticatedWiringReview(f.locations, f.before, f.turn).callId).toBe('control');
    const entry = f.turn.entries[1];
    assert.ok(entry?.payload && typeof entry.payload.output === 'string');
    switch (fault) {
      case 'partial': {
        entry.payload.output = entry.payload.output.slice(0, 40);
        break;
      }
      case 'mismatch': {
        entry.payload.output = entry.payload.output.replace('approved', 'rejected');
        break;
      }
      case 'duplicate': {
        {
          f.turn.entries.push(structuredClone(entry));
          // No default
        }
        break;
      }
      case 'duplicate-call': {
        const call = f.turn.entries[0];
        assert.ok(call);
        f.turn.entries.push(structuredClone(call));
        break;
      }
    }
    expect(() => authenticatedWiringReview(f.locations, f.before, f.turn)).toThrow(
      /HOST_CONTRACT_PROOF_UNAVAILABLE/,
    );
  },
  20_000,
);

it('refuses a different signed current review at the mixed boundary', async () => {
  const first = await fixture();
  const foreign = await fixture();
  const keys = path.join(first.locations.profile, 'review-keys');
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', keys);
  vi.stubEnv('XDG_STATE_HOME', keys);
  setBoundary(first, true, true);
  expect(authenticatedWiringReview(first.locations, first.before, first.turn).callId).toBe(
    'control',
  );
  const output = foreign.turn.entries[1]?.payload?.output;
  const raw = first.turn.entries[1]?.payload;
  const event = first.turn.events[0]?.item;
  assert.ok(typeof output === 'string' && raw && event);
  raw.output = output;
  event.aggregated_output = output;
  expect(() => authenticatedWiringReview(first.locations, first.before, first.turn)).toThrow(
    /HOST_CONTRACT_PROOF_UNAVAILABLE/,
  );
}, 20_000);
