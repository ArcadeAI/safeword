import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

import { startReviewJob } from '../../src/review/job.js';
import { prepareReviewPacket } from '../../src/review/packet.js';
import { codexInternalCases } from '../fixtures/host-contract/native-contract-cases.js';
import { codexWorkflowTemporaryBase } from '../helpers/codex-internal-workflows.js';
import { authenticatedReviewStatus } from '../helpers/codex-review-authentication.js';
import {
  reviewedWorkflowPair,
  type WorkflowPair,
  workflowReviewCallers,
  workflowReviewCollaborators,
  workflowReviewGroups,
} from '../helpers/codex-reviewed-workflow.js';
import { CodexWorkflowRuntimeActor } from '../helpers/codex-workflow-runtime.js';

const repo = path.resolve(import.meta.dirname, '../../../..');
const scratchPrefix = path.join(codexWorkflowTemporaryBase(), 'codex-guard-scope-');
const root = realpathSync(mkdtempSync(scratchPrefix));
const fixtureFile = path.join(root, 'fixture.json');
const selection = { caseId: codexInternalCases()[0]?.id ?? '', arm: 'single' };
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const originals = new Map<string, Buffer>();
// beforeAll supplies these through real staging before any control executes.
const state = {} as { pair: WorkflowPair; fixture: Parameters<typeof reviewedWorkflowPair>[0] };
function replace(file: string, value: unknown) {
  if (!originals.has(file)) originals.set(file, readFileSync(file));
  writeFileSync(file, JSON.stringify(value));
}
function check(reviewId: string, rawDeltaReviewId: string) {
  return reviewedWorkflowPair(
    state.fixture,
    {
      ...selection,
      reviewId,
      rawDeltaReviewId,
      manifest: path.join(state.pair.project, 'staged-inputs.json'),
    },
    root,
  );
}
async function approve(scope: ReturnType<typeof workflowReviewGroups>[number]) {
  const job = await startReviewJob({
    cwd: state.pair.project,
    kind: 'quality-review',
    ...scope,
  });
  expect(job.data).toMatchObject({
    status: process.env.SCOPE_REJECT ? 'changes_requested' : 'approved',
  });
  const id = (job.data as { review_id: string }).review_id;
  expect(authenticate(id, scope).receipt.status).toBe('approved');
  return id;
}

function authenticate(reviewId: string, scope: ReturnType<typeof workflowReviewGroups>[number]) {
  return authenticatedReviewStatus(
    {
      project: state.pair.project,
      profile: root,
      installed: path.dirname(path.dirname(state.pair.coordinator)),
      artifacts: root,
    },
    [],
    { reviewId, targets: [...scope.targets], context: scope.context, exact: true },
  );
}
async function reviews() {
  const [code, raw] = workflowReviewGroups(state.pair);
  return [await approve(code), await approve(raw)] as const;
}

// Construct the approved role independently from the helper under test.
function judgedRawRole() {
  const code = workflowReviewGroups(state.pair)[0];
  const index = path.join(state.pair.project, 'canonical-input-delta.json');
  const targets = Object.values<string>(json(index).inputs);
  expect(targets).toHaveLength(9);
  expect(code.targets).toHaveLength(44);
  expect(code.context).toHaveLength(6);
  const first = state.pair.stages[0];
  assert.ok(first);
  const staged = (file: string) => path.join(first.source, 'packages/cli', file);
  return {
    role: 'raw-deltas' as const,
    targets: [...targets, ...workflowReviewCollaborators.map(staged)],
    context: [...code.context, ...workflowReviewCallers.map(staged)],
  };
}

// Real staging/generation/packet capture/current sealed job readers. Only the
// external reviewer is fake; these are NOT independent approvals of ROOT bytes.
beforeAll(() => {
  const profile = path.join(root, 'profile'),
    project = path.join(root, 'project');
  const installedPath = path.join(profile, 'plugins/cache/original');
  mkdirSync(project);
  cpSync(path.join(repo, 'packages/cli/codex-plugin'), installedPath, { recursive: true });
  writeFileSync(path.join(profile, 'config.toml'), '');
  const binary = path.join(root, 'native-forbidden');
  writeFileSync(binary, '#!/bin/sh\necho NATIVE_MUST_NOT_RUN >&2\nexit 93\n', { mode: 0o755 });
  state.fixture = { root, profile, project, installedPath, binary };
  const hookManifestSha256 = digest(path.join(installedPath, 'hooks.json'));
  const packageManifestSha256 = digest(path.join(installedPath, '.codex-plugin/plugin.json'));
  const runtimeSha256 = digest(path.join(installedPath, 'runtime/cli.js'));
  writeFileSync(
    fixtureFile,
    JSON.stringify({
      ...state.fixture,
      hookManifestSha256,
      packageManifestSha256,
    }),
  );
  const identity = path.join(root, 'identity.json');
  writeFileSync(
    identity,
    JSON.stringify({
      originalManifest: hookManifestSha256,
      runtimeSha256,
    }),
  );
  state.pair = new CodexWorkflowRuntimeActor(fixtureFile, identity).stageRevisions(selection);
  const bun = spawnSync(path.join(repo, 'scripts/dev'), ['bun', '-p', 'process.execPath'], {
    encoding: 'utf8',
  }).stdout.trim();
  const worker = path.join(root, 'worker.mjs');
  const completion = `import {completeReviewJob} from ${JSON.stringify(path.join(repo, 'packages/cli/src/review/job.ts'))};import * as resultFactory from ${JSON.stringify(path.join(repo, 'packages/cli/src/cli-protocol/result.ts'))};const reject=!!process.env.SCOPE_REJECT;completeReviewJob(process.cwd(),process.env.SAFEWORD_REVIEW_JOB_ID,resultFactory.createResult({state:reject?'action_required':'healthy',data:{command:'review run',status:reject?'changes_requested':'approved',author_agent:'codex',actual_reviewer:'claude',independence:'cross-agent',reviewer_output:{schema_version:1,dispatch_id:'source-control',reviewer_agent:'claude',verdict:reject?'request_changes':'approve',summary:'Fake external reviewer, source control only',findings:[]}}}));`;
  writeFileSync(
    worker,
    `import{spawnSync}from'node:child_process';const r=spawnSync(${JSON.stringify(bun)},['--no-env-file','-e',${JSON.stringify(completion)}],{cwd:process.cwd(),env:process.env,stdio:'inherit'});process.exit(r.status??1);`,
  );
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', path.join(root, 'keys'));
  vi.stubEnv('XDG_STATE_HOME', path.join(root, 'keys'));
  vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker);
  vi.stubEnv('SAFEWORD_PLUGIN_CLI', state.pair.coordinator);
}, 180_000);
afterEach(() => {
  for (const [file, bytes] of originals) writeFileSync(file, bytes);
  originals.clear();
  vi.stubEnv('SCOPE_REJECT', undefined);
});
afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

it('accepts complete generation raw bytes through both current captured roles', async () => {
  expect(check(...(await reviews()))).toEqual(state.pair);
});

it('requires raw bytes as judged targets rather than context of an index target', async () => {
  const [code] = workflowReviewGroups(state.pair);
  const raw = judgedRawRole();
  const index = path.join(state.pair.project, 'canonical-input-delta.json');
  const oldRole = {
    ...raw,
    targets: [index],
    context: [...raw.context.filter(file => file !== index), ...raw.targets],
  };
  const codeId = await approve(code);
  const oldId = await approve(oldRole);
  expect(() => check(codeId, oldId)).toThrow('staging review targets incomplete');
  expect(workflowReviewGroups(state.pair)[1]).toEqual(raw);
  const rawId = await approve(raw);
  expect(check(codeId, rawId)).toEqual(state.pair);
});

it.each(['missing', 'extra', 'demoted'] as const)(
  'refuses %s judged raw targets after normal capture',
  async fault => {
    const [code] = workflowReviewGroups(state.pair);
    const raw = judgedRawRole();
    const first = raw.targets[0];
    assert.ok(first);
    if (fault === 'extra') {
      const a = state.pair.stages[0];
      assert.ok(a);
      raw.targets.push(path.join(a.source, 'packages/cli/src/schema.ts'));
    } else {
      raw.targets = raw.targets.slice(1);
      if (fault === 'demoted') raw.context.push(first);
    }
    const ids = [await approve(code), await approve(raw)] as const;
    expect(() => check(...ids)).toThrow(
      fault === 'extra' ? 'staging review targets differ' : 'staging review targets incomplete',
    );
  },
);

it('refuses a changed common input after both judged roles were current', async () => {
  const [code] = workflowReviewGroups(state.pair);
  const raw = judgedRawRole();
  const ids = [await approve(code), await approve(raw)] as const;
  const file = raw.context[0];
  assert.ok(file);
  originals.set(file, readFileSync(file));
  writeFileSync(file, `${readFileSync(file, 'utf8')}\n`);
  expect(() => check(...ids)).toThrow('staging review not approved/current');
});
it.each(['missing', 'extra', 'wrong-path'])(
  'refuses an approving job with %s raw input delta',
  async fault => {
    const file = path.join(state.pair.project, 'canonical-input-delta.json');
    const delta = json(file),
      inputs = delta.inputs ?? delta;
    const first = Object.keys(inputs)[0];
    assert.ok(first);
    if (fault === 'missing') Reflect.deleteProperty(inputs, first);
    else if (fault === 'extra') inputs['unlisted.ts'] = 'unlisted.json';
    else inputs[first] = `${String(inputs[first])}not the actual path`;
    replace(file, delta);
    const ids = await reviews();
    expect(() => check(...ids)).toThrow('input delta differs');
  },
);
it('refuses captured raw bytes that disagree with actual A/B inputs', async () => {
  const delta = json(path.join(state.pair.project, 'canonical-input-delta.json'));
  const file = Object.values<string>(delta.inputs)[0];
  assert.ok(file);
  const raw = json(file);
  raw.B = `${String(raw.B)}not the actual bytes`;
  replace(file, raw);
  const ids = await reviews();
  expect(() => check(...ids)).toThrow('raw input delta differs');
});
it('refuses an actual changed input omitted from the delta even with current inventory approval', async () => {
  const b = state.pair.stages[1];
  assert.ok(b);
  const file = path.join(b.source, 'packages/cli/src/schema.ts');
  originals.set(file, readFileSync(file));
  writeFileSync(file, `${readFileSync(file, 'utf8')}\n// changed staged input\n`);
  const inventory = json(b.inputs);
  inventory.roots['packages/cli/src']['schema.ts'] = digest(file);
  replace(b.inputs, inventory);
  const ids = await reviews();
  expect(() => check(...ids)).toThrow('input delta differs');
});
it('refuses an actual input tree that disagrees with its captured inventory', async () => {
  const b = state.pair.stages[1];
  assert.ok(b);
  const file = path.join(b.source, 'packages/cli/src/schema.ts');
  originals.set(file, readFileSync(file));
  writeFileSync(file, `${readFileSync(file, 'utf8')}\n// unrecorded input change\n`);
  const ids = await reviews();
  expect(() => check(...ids)).toThrow('input tree differs');
});
it('refuses raw-only currency loss while the code review remains current', async () => {
  const ids = await reviews();
  expect(check(...ids)).toEqual(state.pair);
  const delta = json(path.join(state.pair.project, 'canonical-input-delta.json'));
  const file = Object.values<string>(delta.inputs)[0];
  assert.ok(file);
  // Whitespace changes captured bytes without changing the parsed raw-delta value.
  originals.set(file, readFileSync(file));
  writeFileSync(file, `${readFileSync(file, 'utf8')}\n`);
  expect(authenticate(ids[0], workflowReviewGroups(state.pair)[0]).receipt.status).toBe('approved');
  expect(() => authenticate(ids[1], workflowReviewGroups(state.pair)[1])).toThrow(
    'staging review not approved/current',
  );
  expect(() => check(...ids)).toThrow('staging review not approved/current');
});
it.each(['keyset', 'baseline'])('refuses %s generation input faults', async fault => {
  for (const stage of state.pair.stages) {
    if (fault === 'keyset' && stage.label === 'A') continue;
    const file = path.join(stage.source, 'packages/cli/src/schema.ts');
    originals.set(file, readFileSync(file));
    const inventory = json(stage.inputs);
    if (fault === 'keyset') {
      rmSync(file);
      Reflect.deleteProperty(inventory.roots['packages/cli/src'], 'schema.ts');
    } else {
      writeFileSync(file, `${readFileSync(file, 'utf8')}\n// identical foreign baseline\n`);
      inventory.roots['packages/cli/src']['schema.ts'] = digest(file);
    }
    replace(stage.inputs, inventory);
  }
  const ids = await reviews();
  expect(() => check(...ids)).toThrow(
    fault === 'keyset' ? 'input keysets differ' : 'baseline input differs',
  );
});
it('requires B and rechecks execution inputs after an accepted pair', async () => {
  const ids = await reviews();
  check(...ids);
  const b = state.pair.stages[1];
  assert.ok(b);
  renameSync(b.source, `${b.source}-hidden`);
  try {
    expect(() => check(...ids)).toThrow(/ENOENT.*\/B/u);
  } finally {
    renameSync(`${b.source}-hidden`, b.source);
  }
  const file = path.join(b.source, 'packages/cli/tests/helpers/codex-reviewed-workflow.ts');
  originals.set(file, readFileSync(file));
  writeFileSync(file, `${readFileSync(file, 'utf8')}\n// post-acceptance change\n`);
  expect(() => check(...ids)).toThrow('capture/source version differs');
});

it('captures every owned Codex helper and the exercised entrypoints without projections', async () => {
  const ids = await reviews();
  expect(check(...ids)).toEqual(state.pair);
  const a = state.pair.stages[0];
  assert.ok(a);
  for (const relative of [
    ...readdirSync(path.join(repo, 'packages/cli/tests/helpers'))
      .filter(name => /^codex-.*\.(?:ts|py)$/u.test(name))
      .map(name => `packages/cli/tests/helpers/${name}`),
    'packages/cli/scripts/generate-codex-plugin.ts',
    'packages/cli/scripts/check-codex-internal-workflows.ts',
    'packages/cli/tests/fixtures/host-contract/codex-workflow-runtime.steps.ts',
    'packages/cli/tests/fixtures/host-contract/codex-workflow-closure.mjs',
    'packages/cli/tests/helpers/codex-workflow-observation.ts',
    'packages/cli/tests/helpers/codex-workflow-essential.ts',
    'packages/cli/tests/helpers/codex-workflow-git.ts',
    'packages/cli/tests/helpers/codex-workflow-picker.py',
    'steps/consistent-host-contract.steps.ts',
    'packages/cli/src/cli.ts',
    'packages/cli/src/review/coordinator.ts',
  ])
    expect(state.pair.targets).toContain(path.join(a.source, relative));
  const capturedPaths = new Set<string>();
  for (const group of workflowReviewGroups(state.pair)) {
    const captured = prepareReviewPacket(
      state.pair.project,
      'quality-review',
      group.targets,
      group.context,
    );
    try {
      expect(captured.excludedTargets).toEqual([]);
      expect(captured.sourceChanged()).toBe(false);
      expect(captured.snapshotChanged()).toBe(false);
      for (const file of [
        ...captured.packet.logical_files,
        ...(captured.packet.context_files ?? []),
      ]) {
        expect(file.representation).toBeUndefined();
        capturedPaths.add(path.resolve(state.pair.project, file.path));
      }
      const capacity = {
        stagedGroupCapacity: group.role,
        bytes: Buffer.byteLength(JSON.stringify(captured.packet), 'utf8'),
        targets: captured.packet.logical_files.length,
        context: captured.packet.context_files?.length,
      };
      process.stdout.write(`${JSON.stringify(capacity)}\n`);
    } finally {
      captured.cleanup();
    }
  }
  expect([...capturedPaths].toSorted((left, right) => left.localeCompare(right))).toEqual(
    [...new Set([...state.pair.targets, ...state.pair.context])].toSorted((left, right) =>
      left.localeCompare(right),
    ),
  );
});
it.each(['omitted-capture', 'extra-capture'] as const)(
  'refuses %s of a relevant actual source',
  async fault => {
    const [code, raw] = workflowReviewGroups(state.pair);
    const a = state.pair.stages[0];
    assert.ok(a);
    const relevant = path.join(
      a.source,
      'packages/cli/tests/helpers/codex-workflow-observation.ts',
    );
    const targets =
      fault === 'omitted-capture'
        ? code.targets.filter(file => file !== relevant)
        : [...code.targets, path.join(a.source, 'packages/cli/src/schema.ts')];
    const ids = [await approve({ ...code, targets }), await approve(raw)] as const;
    expect(() => check(...ids)).toThrow(
      fault === 'omitted-capture'
        ? 'staging review targets incomplete'
        : 'staging review targets differ',
    );
  },
);

it.each(['omitted', 'extra'] as const)(
  'refuses %s source scope in the owned descriptor',
  async fault => {
    const a = state.pair.stages[0];
    assert.ok(a);
    const relevant = path.join(
      a.source,
      'packages/cli/tests/helpers/codex-workflow-observation.ts',
    );
    const targets =
      fault === 'omitted'
        ? state.pair.targets.filter(file => file !== relevant)
        : [...state.pair.targets, path.join(a.source, 'packages/cli/src/schema.ts')];
    replace(path.join(state.pair.project, 'staged-inputs.json'), { ...state.pair, targets });
    const ids = await reviews();
    expect(() => check(...ids)).toThrow('source targets differ');
  },
);

it('rechecks a newly covered B helper while both review receipts remain current', async () => {
  const ids = await reviews();
  expect(check(...ids)).toEqual(state.pair);
  const b = state.pair.stages[1];
  assert.ok(b);
  const file = path.join(b.source, 'packages/cli/tests/helpers/codex-workflow-observation.ts');
  originals.set(file, readFileSync(file));
  writeFileSync(file, `${readFileSync(file, 'utf8')}\n// changed B observation implementation\n`);
  const [code, raw] = workflowReviewGroups(state.pair);
  expect(authenticate(ids[0], code).receipt.status).toBe('approved');
  expect(authenticate(ids[1], raw).receipt.status).toBe('approved');
  expect(() => check(...ids)).toThrow('capture/source version differs');
});
