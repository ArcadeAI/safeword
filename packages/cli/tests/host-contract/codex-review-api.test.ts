import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { createResult } from '../../src/cli-protocol/result.js';
import { startReviewJob } from '../../src/review/job.js';
import { controlledGrader } from '../helpers/codex-controlled-grader.js';
import { provisionIsolatedGrade } from '../helpers/codex-isolated-project.js';
import { authenticatedWiringReview, reviewJobs } from '../helpers/codex-review-authentication.js';
import { seedWiringReview, wiringReviewBytes } from '../helpers/codex-review-wiring.js';
import { pairedWiringClaim } from '../helpers/codex-wiring-claim.js';
import { dispatchWiringClaim } from '../helpers/codex-wiring-dispatch.js';
import { authenticatedWiringGrade, wiringReference } from '../helpers/codex-wiring-grade.js';
import type { NativeTurn } from '../helpers/codex-workflow-observation.js';

const repo = path.resolve(import.meta.dirname, '../../../..');
const installed = path.join(repo, 'packages/cli/codex-plugin');
const roots: string[] = [];

function poisonCandidate(fault: string, right: Parameters<typeof pairedWiringClaim>[0][number]) {
  switch (fault) {
    case 'stale-second': {
      writeFileSync(path.join(right.locations.project, 'clamp.js'), 'stale');
      break;
    }
    case 'old-second': {
      right.before.push(...reviewJobs(right.locations.project));
      break;
    }
    case 'foreign-call': {
      const output = right.turn.entries[1]?.payload;
      if (!output) throw new Error('Missing call output');
      output.call_id = 'foreign';
      break;
    }
    // No default
  }
}

it.each([
  'approve',
  'negative',
  'unknown',
  'inline',
  'old',
  'stale',
  'unsigned',
  'foreign-id',
  'candidate-model',
])(
  'authenticates real installed claim-grade status: %s',
  async fault => {
    const f = await fixture(false, fault);
    switch (fault) {
      case 'old': {
        f.before.push(f.id);
        break;
      }
      case 'stale': {
        writeFileSync(path.join(f.locations.project, 'claim.json'), '{"claim":false}\n');
        break;
      }
      case 'unsigned': {
        const job = JSON.parse(readFileSync(f.job, 'utf8'));
        delete job.integrity;
        writeFileSync(f.job, JSON.stringify(job));

        break;
      }
      // No default
    }
    const expected = {
      id: fault === 'foreign-id' ? 'foreign' : f.id,
      claim: readFileSync(path.join(f.locations.project, 'claim.json'), 'utf8'),
      candidates: [
        {
          agent: 'claude',
          confirmed: {
            provider: 'anthropic',
            model: fault === 'candidate-model' ? 'opus' : 'claude-opus-5',
          },
        },
      ],
    };
    const read = () => authenticatedWiringGrade(f.locations, f.before, expected);
    if (fault === 'approve' || fault === 'negative')
      expect(read()).toMatchObject({
        accepted: fault === 'approve',
        provenance: { independence: 'degraded' },
      });
    else expect(read).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
  },
  20_000,
);
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

// Mock ONLY the reviewer worker process. The real coordinator creates/signs/completes
// each job, and the actual bundled CLI authenticates status. No key bytes are read
// or printed by the fixture. These are API/transport controls, NOT native judgments.
function workerRoute(grade?: string, candidateModel = 'claude-opus-5') {
  const agent = grade ? 'codex' : 'claude';
  const independence = grade ? 'degraded' : 'cross-agent';
  return {
    actual_reviewer: agent,
    reviewer_model: grade ? 'gpt-6-astra' : 'opus',
    independence: grade === 'inline' ? 'reduced' : independence,
    ...(!grade &&
      candidateModel !== 'unknown' && {
        confirmed_reviewer_model: { provider: 'anthropic', model: candidateModel },
      }),
    ...(grade &&
      grade !== 'unknown' && {
        confirmed_reviewer_model: { provider: 'openai', model: 'gpt-6-astra' },
      }),
  };
}
function workerResult(grade?: string, candidateModel?: string) {
  const approved = grade !== undefined && grade !== 'negative';
  const route = workerRoute(grade, candidateModel);
  return createResult({
    state: approved ? 'healthy' : 'action_required',
    data: {
      command: 'review run',
      status: approved ? 'approved' : 'changes_requested',
      author_agent: 'codex',
      ...route,
      reviewer_output: {
        schema_version: 1,
        dispatch_id: 'synthetic-worker',
        reviewer_agent: route.actual_reviewer,
        verdict: approved ? 'approve' : 'request_changes',
        summary: 'boundary control only',
        findings: approved ? [] : [{ severity: 'error', message: 'fixture finding' }],
      },
    },
  });
}
async function dispatchFixtureReview(
  locations: Parameters<typeof dispatchWiringClaim>[0],
  wrongTargets: boolean,
  grade?: string,
  absoluteTargets = false,
) {
  if (grade?.startsWith('bound')) {
    const dispatch = dispatchWiringClaim(locations, '{"claim":true}\n', [
      { agent: 'claude', confirmed: { provider: 'anthropic', model: 'claude-opus-5' } },
    ]);
    return { dispatch, status: dispatch.response };
  }
  const nativeTargets = wrongTargets ? ['clamp.js'] : ['clamp.js', 'clamp.test.js'];
  const context = absoluteTargets ? [path.join(locations.project, 'package.json')] : [];
  return {
    dispatch: undefined,
    status: await startReviewJob({
      cwd: locations.project,
      kind: 'quality-review',
      targets: grade
        ? ['claim.json']
        : nativeTargets.map(target =>
            absoluteTargets ? path.join(locations.project, target) : target,
          ),
      context: grade ? ['reference.md'] : context,
    }),
  };
}

function fixtureLocations(root: string, grade?: string) {
  if (grade?.startsWith('bound')) {
    const control = controlledGrader(root);
    roots.push(control.bin);
    const owned = provisionIsolatedGrade(root, control.authProfile);
    owned.environment.PATH = control.environment.PATH;
    return { locations: { ...owned, artifacts: root }, control };
  }
  const project = path.join(root, 'project'),
    profile = path.join(root, 'profile');
  mkdirSync(project);
  mkdirSync(profile);
  return { locations: { project, profile, installed, artifacts: root }, control: undefined };
}

async function fixture(
  wrongTargets: boolean,
  grade?: string,
  candidateModel?: string,
  sharedKeyRoot?: string,
  absoluteTargets = false,
) {
  const temporary = mkdtempSync(path.join(tmpdir(), 'safeword-review-api-'));
  const root = realpathSync(temporary);
  roots.push(root);
  const { locations, control } = fixtureLocations(root, grade);
  const { project, profile } = locations;
  seedWiringReview(project, 'defective');
  if (absoluteTargets) writeFileSync(path.join(project, 'package.json'), '{"private":true}\n');
  if (grade && !grade.startsWith('bound')) {
    writeFileSync(path.join(project, 'claim.json'), '{"claim":true}\n');
    copyFileSync(wiringReference, path.join(project, 'reference.md'));
  }
  const keyRoot = sharedKeyRoot ?? path.join(profile, 'review-keys');
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', keyRoot);
  // Source test mode and production bundle share one disposable key, while
  // mise keeps its existing trust state; no new trust grant or shared key write.
  const originalState = process.env.XDG_STATE_HOME ?? path.join(homedir(), '.local/state');
  vi.stubEnv('MISE_STATE_DIR', process.env.MISE_STATE_DIR ?? path.join(originalState, 'mise'));
  vi.stubEnv('XDG_STATE_HOME', keyRoot);
  vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');
  const worker = path.join(root, 'worker.mjs');
  const reviewer = path.join(root, 'reviewer.ts');
  writeFileSync(
    reviewer,
    `
import {completeReviewJob} from ${JSON.stringify(path.join(repo, 'packages/cli/src/review/job.ts'))};
import {createResult} from ${JSON.stringify(path.join(repo, 'packages/cli/src/cli-protocol/result.ts'))};
completeReviewJob(process.cwd(),process.env.SAFEWORD_REVIEW_JOB_ID,${JSON.stringify(workerResult(grade, candidateModel))});`,
  );
  writeFileSync(
    worker,
    `import{spawnSync}from'node:child_process';import{writeFileSync as save}from'node:fs';const r=spawnSync(${JSON.stringify(path.join(repo, 'scripts/dev'))},['bun',${JSON.stringify(reviewer)},...process.argv.slice(2)],{env:process.env,encoding:'utf8'});save(${JSON.stringify(path.join(root, 'worker-result.json'))},JSON.stringify({status:r.status,stdout:r.stdout,stderr:r.stderr}));process.exitCode=r.status??1;`,
  );
  vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker);
  const before = reviewJobs(project);
  const { dispatch, status } = await dispatchFixtureReview(
    locations,
    wrongTargets,
    grade,
    absoluteTargets,
  );
  if (control) {
    const trace = readFileSync(path.join(control.bin, 'observations.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    writeFileSync(
      path.join(root, 'dispatched-packet.json'),
      JSON.stringify(trace.find(row => row.packet).packet),
    );
  } else {
    await expect.poll(() => existsSync(path.join(root, 'worker-result.json'))).toBe(true);
  }
  expect(status.data).toMatchObject({
    status: (workerResult(grade).data as { status: string }).status,
  });
  if ('cleanupCredentials' in locations) locations.cleanupCredentials();
  const id = (status.data as { review_id: string }).review_id;
  const runtime = path.join(locations.installed, 'runtime/cli.js');
  const command = `SAFEWORD_PLUGIN_RUNTIME=${runtime}; bun "$SAFEWORD_PLUGIN_RUNTIME" review status ${id} --json`;
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
          type: 'function_call',
          call_id: 'control',
          arguments: JSON.stringify({ cmd: command }),
        },
      },
      {
        type: 'response_item',
        payload: { type: 'function_call_output', call_id: 'control', output },
      },
    ],
    events: [
      {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: `/bin/zsh -lc '${command}'`,
          exit_code: 2,
          aggregated_output: output,
        },
      },
    ],
  };
  return {
    locations,
    dispatch,
    before,
    turn,
    id,
    job: path.join(project, '.safeword/state/reviews', `${id}.json`),
  };
}

function bindAbsoluteReviewTurn(f: Awaited<ReturnType<typeof fixture>>, preparation = '') {
  // Actual signed status; synthetic native boundary is NOT a native receipt.
  const runtime = path.join(f.locations.installed, 'runtime/cli.js');
  const shell = `${preparation}SAFEWORD_PLUGIN_RUNTIME=${runtime}; PROJECT_DIR=${f.locations.project}; bun "$SAFEWORD_PLUGIN_RUNTIME" review run quality-review --context "$PROJECT_DIR/package.json" --agent-handoff --json -- "$PROJECT_DIR/clamp.js" "$PROJECT_DIR/clamp.test.js"`;
  const call = f.turn.entries[0]?.payload,
    response = f.turn.entries[1]?.payload,
    item = f.turn.events[0]?.item;
  if (!call || !response || !item) throw new Error('Missing synthetic boundary');
  call.type = 'custom_tool_call';
  delete call.arguments;
  call.input = `const r = await tools.exec_command(${JSON.stringify({ cmd: shell, workdir: f.locations.project })}); text(r.output);`;
  response.type = 'custom_tool_call_output';
  item.command = `/bin/zsh -lc '${shell.replaceAll("'", "'\"'\"'")}'`;
  item.exit_code = 0;
  return call;
}

function discoveryBoundary(turn: NativeTurn) {
  const response = turn.entries[1]?.payload;
  const item = turn.events[0]?.item;
  const input = turn.entries[0]?.payload?.input;
  if (!response || !item?.command || typeof input !== 'string')
    throw new Error('Missing synthetic boundary');
  return { response, item, command: item.command, input };
}

it.each(['current', 'unsigned', 'foreign-cwd', 'partial', 'foreign-shell'])(
  'authenticates installed current status after discovery: %s',
  async fault => {
    const f = await fixture(false, undefined, undefined, undefined, true);
    const call = bindAbsoluteReviewTurn(
      f,
      String.raw`printf '\nFiles\n'; find . -name '*.js' | head -10; `,
    );
    const { response, item, command, input } = discoveryBoundary(f.turn);
    switch (fault) {
      case 'unsigned': {
        const job = JSON.parse(readFileSync(f.job, 'utf8'));
        delete job.integrity;
        writeFileSync(f.job, JSON.stringify(job));

        break;
      }
      case 'foreign-cwd': {
        call.input = input.replace(`${f.locations.project}"}`, '/foreign"}');
        break;
      }
      case 'partial': {
        response.output = '{}';
        break;
      }
      case 'foreign-shell': {
        item.command = command.replace('/bin/zsh', '/bin/sh');
        break;
      }
    }
    const read = () => authenticatedWiringReview(f.locations, f.before, f.turn);
    if (fault !== 'current') {
      expect(read).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
      return;
    }
    expect(read()).toMatchObject({
      callId: 'control',
      reviewId: f.id,
      output: { verdict: 'request_changes' },
    });
  },
);

it.each(['current', 'second job', 'changed target'])(
  'binds opaque preparation to installed authority despite child effects: %s',
  async fault => {
    const f = await fixture(false, undefined, undefined, undefined, true);
    bindAbsoluteReviewTurn(
      f,
      `npm test; node --input-type=module -e "import { clamp } from './clamp.js'; console.log(clamp(4, 0, 10))"; `,
    );
    if (fault === 'second job') await dispatchFixtureReview(f.locations, false);
    else if (fault === 'changed target')
      writeFileSync(path.join(f.locations.project, 'clamp.js'), 'changed by child');
    const read = () => authenticatedWiringReview(f.locations, f.before, f.turn);
    if (fault !== 'current') {
      expect(read).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
      return;
    }
    expect(read()).toMatchObject({
      callId: 'control',
      reviewId: f.id,
      output: { verdict: 'request_changes' },
    });
  },
);

it.each(['current', 'stale', 'unsigned', 'foreign-call'])(
  'correlates actual installed absolute-target status: %s',
  async fault => {
    const f = await fixture(false, undefined, undefined, undefined, true);
    const call = bindAbsoluteReviewTurn(f);
    switch (fault) {
      case 'stale': {
        writeFileSync(path.join(f.locations.project, 'clamp.js'), 'stale');
        break;
      }
      case 'unsigned': {
        const job = JSON.parse(readFileSync(f.job, 'utf8'));
        delete job.integrity;
        writeFileSync(f.job, JSON.stringify(job));

        break;
      }
      case 'foreign-call': {
        call.call_id = 'foreign';
        break;
      }
      // No default
    }
    const read = () => authenticatedWiringReview(f.locations, f.before, f.turn);
    if (fault !== 'current') {
      expect(read).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
      return;
    }
    expect(read()).toMatchObject({
      reviewId: f.id,
      callId: 'control',
      provenance: {
        review_targets: [
          path.join(f.locations.project, 'clamp.js'),
          path.join(f.locations.project, 'clamp.test.js'),
        ],
      },
    });
  },
  20_000,
);

it.each(['current', 'claim', 'reference'])(
  'binds real coordinator worker context and immutable view: %s (synthetic candidate claims)',
  async fault => {
    const f = await fixture(false, 'bound');
    const packet = JSON.parse(
      readFileSync(path.join(f.locations.artifacts, 'dispatched-packet.json'), 'utf8'),
    );
    expect(packet.logical_files).toEqual([{ path: 'claim.json', content: '{"claim":true}\n' }]);
    expect(packet.context_files).toEqual([
      { path: 'reference.md', content: readFileSync(wiringReference, 'utf8') },
    ]);
    if (!f.dispatch) throw new Error('Missing dispatch');
    if (fault !== 'current')
      writeFileSync(
        path.join(f.locations.project, fault === 'claim' ? 'claim.json' : 'reference.md'),
        'stale',
      );
    const read = () => f.dispatch?.read();
    if (fault === 'current') expect(read()).toMatchObject({ accepted: true, reviewId: f.id });
    else expect(read).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
  },
  20_000,
);

it.each([
  'current',
  'stale-second',
  'old-second',
  'foreign-call',
  'unknown-model',
  'alias-model',
  'duplicate-project',
  'duplicate-alias',
])(
  'produces a neutral claim only from two authenticated current native candidates: %s',
  async fault => {
    const first = await fixture(false);
    const models: Record<string, string> = { 'unknown-model': 'unknown', 'alias-model': 'opus' };
    // Both production status queries use the same disposable user key, just as
    // real per-project jobs do; no shared or original author key is accessed.
    const second = await fixture(
      false,
      undefined,
      models[fault],
      path.join(first.locations.profile, 'review-keys'),
    );
    const inputs = [first, second].map(f => ({
      ...f,
      bytes: wiringReviewBytes(f.locations.project),
    }));
    const [left, right] = inputs;
    if (!left || !right) throw new Error('Missing candidate');
    poisonCandidate(fault, right);
    const alias = {
      ...left,
      locations: { ...left.locations, project: `${left.locations.project}/.` },
    };
    const peers: Record<string, typeof left> = {
      'duplicate-project': left,
      'duplicate-alias': alias,
    };
    const build = () => pairedWiringClaim([left, peers[fault] ?? right]);
    if (fault !== 'current') {
      expect(build).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
      return;
    }
    const result = build();
    const view = JSON.parse(result.claim);
    expect(view.projects).toHaveLength(2);
    expect(view.projects[0].id).not.toBe(view.projects[1].id);
    for (const project of view.projects) {
      expect(project.files).toEqual(left.bytes);
      expect(Object.keys(project)).toEqual(['id', 'files', 'review']);
      expect(Object.keys(project.review)).toEqual(['verdict', 'findings']);
      expect(project.review.findings).toEqual([{ severity: 'error', message: 'fixture finding' }]);
    }
    for (const cue of [
      first.id,
      second.id,
      first.locations.project,
      second.locations.profile,
      'claude-opus-5',
      'cross-agent',
      'defective',
      'synthetic-worker',
    ])
      expect(result.claim).not.toContain(cue);
    expect(result.provenance.map(receipt => receipt.reviewId)).toEqual([first.id, second.id]);
    expect(result.candidates).toHaveLength(2);
    // Boundary control, NOT a model judgment: actual signed candidate statuses
    // and correlated native-shaped outputs feed the real bound grade worker.
    const control = controlledGrader(first.locations.artifacts);
    roots.push(control.bin);
    const owned = provisionIsolatedGrade(first.locations.artifacts, control.authProfile);
    owned.environment.PATH = control.environment.PATH;
    try {
      const dispatch = dispatchWiringClaim(owned, result.claim, result.candidates);
      expect(dispatch.read()).toMatchObject({
        accepted: true,
        provenance: {
          actual_reviewer: 'codex',
          independence: 'degraded',
          confirmed_reviewer_model: { provider: 'openai', model: 'gpt-6-astra' },
        },
      });
      expect(readFileSync(path.join(owned.project, 'claim.json'), 'utf8')).toBe(result.claim);
    } finally {
      owned.cleanupCredentials();
    }
  },
  30_000,
);

it.each(['current', 'old-job', 'unsigned', 'stale', 'foreign', 'wrong-key', 'wrong-targets'])(
  'normal installed API rejects invalid %s authority',
  async fault => {
    const f = await fixture(fault === 'wrong-targets');
    switch (fault) {
      case 'old-job': {
        f.before.push(f.id);
        break;
      }
      case 'unsigned': {
        const record = JSON.parse(readFileSync(f.job, 'utf8'));
        delete record.integrity;
        writeFileSync(f.job, JSON.stringify(record));

        break;
      }
      case 'stale': {
        writeFileSync(path.join(f.locations.project, 'clamp.js'), 'changed after review\n');
        break;
      }
      case 'foreign': {
        const foreign = path.join(f.locations.artifacts, 'foreign');
        const jobs = path.join(foreign, '.safeword/state/reviews');
        mkdirSync(jobs, { recursive: true });
        copyFileSync(f.job, path.join(jobs, `${f.id}.json`));
        f.locations.project = foreign;

        break;
      }
      case 'wrong-key': {
        f.locations.profile = path.join(f.locations.artifacts, 'other-profile');
        mkdirSync(f.locations.profile);
        vi.stubEnv('XDG_STATE_HOME', path.join(f.locations.profile, 'review-keys'));

        break;
      }
      // No default
    }
    const read = () => authenticatedWiringReview(f.locations, f.before, f.turn);
    if (fault === 'current') {
      let result;
      try {
        result = read();
      } catch (error) {
        throw new Error(
          readFileSync(path.join(f.locations.artifacts, 'review-authentication.json'), 'utf8'),
          { cause: error },
        );
      }
      expect(result).toMatchObject({
        reviewId: f.id,
        callId: 'control',
        provenance: {
          author_agent: 'codex',
          actual_reviewer: 'claude',
          independence: 'cross-agent',
        },
        output: { verdict: 'request_changes' },
      });
    } else expect(read).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
  },
  20_000,
);
