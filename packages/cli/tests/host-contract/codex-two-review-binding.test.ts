import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import { startReviewJob } from '../../src/review/job.js';
import { prepareReviewPacket } from '../../src/review/packet.js';
import { codexInternalCases } from '../fixtures/host-contract/native-contract-cases.js';
import { codexWorkflowTemporaryBase } from '../helpers/codex-internal-workflows.js';
import { authenticatedReviewStatus } from '../helpers/codex-review-authentication.js';
import {
  reviewedWorkflowPair,
  type WorkflowPair,
  workflowReviewGroups,
} from '../helpers/codex-reviewed-workflow.js';
import { CodexWorkflowRuntimeActor } from '../helpers/codex-workflow-runtime.js';
import { largeLockfileFixture } from '../helpers/large-lockfile.js';

// Integration control: real staging, packet capture, sealed job writer and current
// reader. Only the external reviewer is synthetic; no native authority is earned.
const repo = path.resolve(import.meta.dirname, '../../../..');
const prefix = path.join(codexWorkflowTemporaryBase(), 'codex-guard-two-');
const root = realpathSync(mkdtempSync(prefix));
const state: {
  pair?: WorkflowPair;
  fixture?: ConstructorParameters<typeof CodexWorkflowRuntimeActor>[0];
} = {};
const selection = { caseId: codexInternalCases()[0]?.id ?? '', arm: 'single' };
const manifest = () => path.join(prepared().project, 'staged-inputs.json');
function prepared() {
  assert.ok(state.pair);
  return state.pair;
}
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

beforeAll(() => {
  const profile = path.join(root, 'profile'),
    project = path.join(root, 'project');
  const installedPath = path.join(profile, 'plugins/cache/original');
  mkdirSync(project);
  cpSync(path.join(repo, 'packages/cli/codex-plugin'), installedPath, { recursive: true });
  writeFileSync(path.join(profile, 'config.toml'), '');
  const binary = path.join(root, 'native-forbidden');
  writeFileSync(binary, '#!/bin/sh\nexit 93\n', { mode: 0o755 });
  const fixture = path.join(root, 'fixture.json'),
    identity = path.join(root, 'identity.json');
  const hookManifestSha256 = digest(path.join(installedPath, 'hooks.json'));
  const packageManifestSha256 = digest(path.join(installedPath, '.codex-plugin/plugin.json'));
  const runtimeSha256 = digest(path.join(installedPath, 'runtime/cli.js'));
  writeFileSync(
    fixture,
    JSON.stringify({
      root,
      profile,
      project,
      installedPath,
      binary,
      hookManifestSha256,
      packageManifestSha256,
    }),
  );
  writeFileSync(
    identity,
    JSON.stringify({
      originalManifest: hookManifestSha256,
      runtimeSha256,
    }),
  );
  state.pair = new CodexWorkflowRuntimeActor(fixture, identity).stageRevisions(selection);
  state.fixture = fixture;
  const bun = spawnSync(path.join(repo, 'scripts/dev'), ['bun', '-p', 'process.execPath'], {
    encoding: 'utf8',
  }).stdout.trim();
  const worker = path.join(root, 'worker.mjs');
  const completion = `import * as fs from 'node:fs';import * as jobs from ${JSON.stringify(path.join(repo, 'packages/cli/src/review/job.ts'))};import * as results from ${JSON.stringify(path.join(repo, 'packages/cli/src/cli-protocol/result.ts'))};const reject=fs.readFileSync(${JSON.stringify(path.join(root, 'verdict'))},'utf8')==='reject';jobs.completeReviewJob(process.cwd(),process.env.SAFEWORD_REVIEW_JOB_ID,results.createResult({state:reject?'action_required':'healthy',data:{command:'review run',status:reject?'changes_requested':'approved',author_agent:'codex',actual_reviewer:'claude',independence:'cross-agent',reviewer_output:{schema_version:1,dispatch_id:'external-source-control',reviewer_agent:'claude',verdict:reject?'request_changes':'approve',summary:'Disposable source test only',findings:[]}}}));`;
  writeFileSync(
    worker,
    `import{spawnSync}from'node:child_process';const r=spawnSync(${JSON.stringify(bun)},['--no-env-file','-e',${JSON.stringify(completion)}],{cwd:process.cwd(),env:process.env,stdio:'inherit'});process.exit(r.status??1);`,
  );
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', path.join(root, 'test-keys'));
  vi.stubEnv('XDG_STATE_HOME', path.join(root, 'test-keys'));
  vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker);
  vi.stubEnv('SAFEWORD_PLUGIN_CLI', prepared().coordinator);
}, 180_000);
afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

function groups() {
  const pair = prepared();
  return {
    code: { ...workflowReviewGroups(pair)[0] },
    raw: { ...workflowReviewGroups(pair)[1] },
  };
}
async function job(
  scope: { targets: string[]; context: string[] },
  rejected = false,
  cwd = prepared().project,
) {
  writeFileSync(path.join(root, 'verdict'), rejected ? 'reject' : 'approve');
  const result = await startReviewJob({ cwd, kind: 'quality-review', ...scope });
  expect(result.data).toMatchObject({ status: rejected ? 'changes_requested' : 'approved' });
  return (result.data as { review_id: string }).review_id;
}
function observe(reviewId: string, rawDeltaReviewId?: string) {
  assert.ok(state.fixture);
  const fixture = JSON.parse(readFileSync(state.fixture, 'utf8'));
  return reviewedWorkflowPair(
    fixture,
    { ...selection, manifest: manifest(), reviewId, rawDeltaReviewId },
    root,
  );
}

it('accepts two distinct normally captured current roles for the same fixed pair', async () => {
  const { code, raw } = groups();
  expect(observe(await job(code), await job(raw))).toEqual(prepared());
});

it.each(['missing', 'rejected'] as const)(
  'refuses a %s second review after a valid code approval',
  async fault => {
    const { code, raw } = groups();
    const first = await job(code);
    const second = fault === 'missing' ? undefined : await job(raw, true);
    expect(() => observe(first, second)).toThrow(
      fault === 'missing' ? 'raw-deltas review missing' : 'staging review not approved/current',
    );
  },
);

it('refuses the same authenticated ID in both roles', async () => {
  const first = await job(groups().code);
  expect(() => observe(first, first)).toThrow('reviews duplicate');
});

it.each([
  'wrong-role',
  'omitted-target',
  'omitted-context',
  'extra-target',
  'extra-context',
  'partial-union',
] as const)('refuses captured %s scope', async fault => {
  const { code, raw } = groups();
  const extra = path.join(prepared().project, 'extra.ts');
  writeFileSync(extra, 'export {};\n');
  switch (fault) {
    case 'omitted-target': {
      code.targets = code.targets.slice(1);
      break;
    }
    case 'omitted-context': {
      code.context = code.context.slice(1);
      break;
    }
    case 'extra-target': {
      code.targets = [...code.targets, extra];
      break;
    }
    case 'extra-context': {
      raw.context = [...raw.context, extra];
      break;
    }
    case 'partial-union': {
      raw.context = raw.context.slice(1);
      break;
    }
    case 'wrong-role': {
      break;
    }
  }
  const second = fault === 'wrong-role' ? code : raw;
  const expected = {
    'wrong-role': 'targets incomplete',
    'omitted-target': 'targets incomplete',
    'omitted-context': 'context incomplete',
    'extra-target': 'targets differ',
    'extra-context': 'context differs',
    'partial-union': 'context incomplete',
  }[fault];
  // Both jobs must finish normal capture before the reader boundary.
  const awaited = { first: await job(code), second: await job(second) };
  expect(() => observe(awaited.first, awaited.second)).toThrow(expected);
});

it.each(['stale-index', 'changed-common-input'] as const)(
  'refuses %s through the current sealed reader',
  async fault => {
    const { code, raw } = groups();
    const first = await job(code),
      second = await job(raw);
    const file =
      fault === 'stale-index'
        ? raw.context.find(item => item.endsWith('/canonical-input-delta.json'))
        : raw.context[0];
    assert.ok(file);
    const before = readFileSync(file);
    try {
      writeFileSync(file, Buffer.concat([before, Buffer.from('\n')]));
      expect(() => observe(first, second)).toThrow('staging review not approved/current');
    } finally {
      writeFileSync(file, before);
    }
  },
);

it('refuses a normally approved job belonging to a foreign project', async () => {
  const foreign = path.join(root, randomUUID());
  mkdirSync(foreign);
  writeFileSync(path.join(foreign, 'source.ts'), 'export {};\n');
  const second = await job({ targets: ['source.ts'], context: [] }, false, foreign);
  const awaited = await job(groups().code);
  expect(() => observe(awaited, second)).toThrow('staging review missing');
});

it('refuses an extra normally captured projected target', async () => {
  const pair = prepared();
  const lock = largeLockfileFixture(pair.project);
  lock.write(lock.before.replace('1.1.0', '1.2.0'));
  const { code, raw } = groups();
  const scope = { targets: [...code.targets, 'bun.lock'], context: code.context };
  const first = await job(scope),
    second = await job(raw);
  const captured = prepareReviewPacket(
    pair.project,
    'quality-review',
    scope.targets,
    scope.context,
  );
  try {
    expect(captured.packet.logical_files.find(file => file.path === 'bun.lock')).toMatchObject({
      representation: { kind: 'git-diff' },
    });
    expect(captured.excludedTargets).toEqual([]);
    expect(captured.sourceChanged()).toBe(false);
    expect(captured.snapshotChanged()).toBe(false);
  } finally {
    captured.cleanup();
  }
  expect(() => observe(first, second)).toThrow('staging review representations differ');
});

it('refuses an extra normally excluded target before exact-scope acceptance', async () => {
  const project = path.join(root, randomUUID());
  mkdirSync(project);
  largeLockfileFixture(project);
  mkdirSync(path.join(project, 'generated'));
  writeFileSync(path.join(project, 'generated/extra.js'), 'x'.repeat(262_145));
  writeFileSync(path.join(project, 'source.ts'), 'export {};\n');
  writeFileSync(path.join(project, 'context.json'), '{}\n');
  const scope = { targets: ['source.ts', 'generated/extra.js'], context: ['context.json'] };
  const reviewId = await job(scope, false, project);
  const captured = prepareReviewPacket(project, 'quality-review', scope.targets, scope.context);
  try {
    expect(captured.excludedTargets).toEqual(['generated/extra.js']);
    expect(captured.sourceChanged()).toBe(false);
    expect(captured.snapshotChanged()).toBe(false);
  } finally {
    captured.cleanup();
  }
  const locations = {
    project,
    profile: root,
    installed: path.dirname(path.dirname(prepared().coordinator)),
    artifacts: root,
  };
  expect(() =>
    authenticatedReviewStatus(locations, [], {
      reviewId,
      targets: ['source.ts'],
      context: scope.context,
      exact: true,
    }),
  ).toThrow('staging review excluded targets');
});
