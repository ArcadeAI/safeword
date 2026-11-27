import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

import { startReviewJob } from '../../src/review/job.js';
import { codexInternalCases } from '../fixtures/host-contract/native-contract-cases.js';
import { codexWorkflowTemporaryBase } from '../helpers/codex-internal-workflows.js';
import { authenticatedReviewStatus } from '../helpers/codex-review-authentication.js';
import {
  reviewedWorkflowPair,
  type WorkflowPair,
  workflowReviewGroups,
} from '../helpers/codex-reviewed-workflow.js';
import { CodexWorkflowRuntimeActor } from '../helpers/codex-workflow-runtime.js';

const repo = path.resolve(import.meta.dirname, '../../../..');
const scratchPrefix = path.join(codexWorkflowTemporaryBase(), 'codex-guard-scope-');
const root = realpathSync(mkdtempSync(scratchPrefix));
const fixtureFile = path.join(root, 'fixture.json');
const selection = { caseId: codexInternalCases()[0]?.id ?? '', arm: 'single' };
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
// beforeAll supplies these through real staging before any control executes.
const state = {} as { pair: WorkflowPair; fixture: Parameters<typeof reviewedWorkflowPair>[0] };
const originals = new Map<string, Buffer>();
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

it('refuses an old nine-target review after valid authenticated capture', async () => {
  const [code] = workflowReviewGroups(state.pair);
  const index = JSON.parse(
    readFileSync(path.join(state.pair.project, 'canonical-input-delta.json'), 'utf8'),
  ) as { inputs: Record<string, string> };
  const targets = Object.values(index.inputs);
  expect(targets).toHaveLength(9);
  const raw = { role: 'raw-deltas' as const, targets, context: [...code.context] };
  expect(raw.context).toHaveLength(6);
  const ids = [await approve(code), await approve(raw)] as const;
  try {
    check(...ids);
  } catch (error) {
    expect(String(error)).toContain('staging review targets incomplete');
    return;
  }
  throw new Error('EXPANDED_STAGED_SCOPE_ACCEPTED');
}, 180_000);

it('accepts both fully captured current expanded roles', async () => {
  const [code, raw] = workflowReviewGroups(state.pair);
  expect(code.context).toHaveLength(6);
  expect(raw.context).toHaveLength(9);
  const first = state.pair.stages[0];
  expect(first).toBeDefined();
  if (!first) throw new Error('missing staged fixture');
  const staged = (file: string) => path.join(first.source, 'packages/cli', file);
  const helperDirectory = staged('tests/helpers');
  const expectedCode = [
    ...readdirSync(helperDirectory)
      .filter(name => /^codex-.*\.(?:ts|py)$/u.test(name))
      .map(name => path.join(helperDirectory, name)),
    ...[
      'scripts/generate-codex-plugin.ts',
      'scripts/check-codex-internal-workflows.ts',
      'tests/fixtures/host-contract/codex-workflow-runtime.steps.ts',
      'tests/fixtures/host-contract/codex-workflow-closure.mjs',
      'tests/fixtures/host-contract/native-contract-cases.ts',
      'tests/helpers/contract-repo-fixture.ts',
      'src/cli.ts',
      'src/review/command.ts',
      'src/review/coordinator.ts',
      'src/review/packet.ts',
      'src/review/job.ts',
      'src/review/planning-context-identity.ts',
      'templates/hooks/lib/read-receipt.ts',
      'templates/hooks/lib/safeword-cli.ts',
      'templates/hooks/run-review.ts',
    ].map(staged),
    path.join(first.source, 'steps/consistent-host-contract.steps.ts'),
    path.join(first.source, 'steps/world.ts'),
  ];
  expect(code.targets.toSorted((left, right) => left.localeCompare(right))).toEqual(
    expectedCode.toSorted((left, right) => left.localeCompare(right)),
  );
  const files = [
    'tests/fixtures/host-contract/codex-node-control.mjs',
    'tests/fixtures/host-contract/build-isolated-grader.mjs',
    'tests/fixtures/host-contract/isolated-grader-reviewer.cjs',
    'scripts/check-codex-internal-reference.ts',
    'scripts/check-codex-wiring-calibration.ts',
    'src/review/isolated-grader.ts',
    'src/review/runtime.ts',
    'tests/helpers/codex-wiring-score.ts',
    'tests/helpers/codex-wiring-capability.ts',
    'tests/helpers/codex-wiring-capability.fixture.ts',
    'tests/helpers/native-helper-command.ts',
    'tests/helpers/native-catalogue-probe.ts',
    'tests/helpers/propagation-policy-case.ts',
    'tests/fixtures/host-contract/codex-stop-observer.mjs',
  ];
  const index = JSON.parse(
    readFileSync(path.join(state.pair.project, 'canonical-input-delta.json'), 'utf8'),
  ) as { inputs: Record<string, string> };
  expect(raw.targets.toSorted((left, right) => left.localeCompare(right))).toEqual(
    [...Object.values(index.inputs), ...files.map(staged)].toSorted((left, right) =>
      left.localeCompare(right),
    ),
  );
  for (const file of [
    'src/review/coordinator.ts',
    'tests/helpers/codex-wiring-grade.ts',
    'tests/helpers/codex-reviewed-workflow.ts',
  ])
    expect(raw.context).toContain(staged(file));
  expect(check(await approve(code), await approve(raw))).toEqual(state.pair);
}, 180_000);

it.each(['target', 'context'] as const)(
  'refuses missing collaborator %s after current capture',
  async fault => {
    const [code, raw] = workflowReviewGroups(state.pair);
    const altered =
      fault === 'target'
        ? { ...raw, targets: raw.targets.slice(0, -1) }
        : { ...raw, context: raw.context.slice(0, -1) };
    const ids = [await approve(code), await approve(altered)] as const;
    expect(() => check(...ids)).toThrow(
      fault === 'target'
        ? 'staging review targets incomplete'
        : 'staging review context incomplete',
    );
  },
  180_000,
);

it('refuses a collaborator changed after both reviews', async () => {
  const [code, raw] = workflowReviewGroups(state.pair);
  const ids = [await approve(code), await approve(raw)] as const;
  const file = raw.targets.at(-1);
  expect(file).toBeDefined();
  if (!file) throw new Error('missing collaborator fixture');
  originals.set(file, readFileSync(file));
  writeFileSync(file, `${readFileSync(file, 'utf8')}\n`);
  expect(() => authenticate(ids[1], raw)).toThrow('staging review not approved/current');
}, 180_000);
