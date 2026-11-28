import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import {
  invocationResult,
  type InvocationScenarioResult,
} from '../../scripts/check-codex-internal-workflows.js';
import { startReviewJob } from '../../src/review/job.js';
import { prepareReviewPacket } from '../../src/review/packet.js';
import { SAFEWORD_TRANSIENT_PATHS } from '../../src/schema.js';
import { codexInternalCases } from '../fixtures/host-contract/native-contract-cases.js';
import { preservationEmbedding } from '../fixtures/host-contract/preservation-control.js';
import { authenticatedReviewStatus } from '../helpers/codex-review-authentication.js';

const repo = path.resolve(import.meta.dirname, '../../../..');
const roots: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

// Only the external review-worker process is synthetic. Normal job creation,
// sealed completion, current-source fingerprinting and CLI status remain real.
// These disposable test-key records are NOT independent staged-package reviews.
async function reviewedInputs(
  context = ['stage-A.json', 'stage-B.json'],
  independence = 'cross-agent',
  stageB = '{"fixed":true}\n',
) {
  const temporary = mkdtempSync(path.join(tmpdir(), 'safeword-staged-inputs-'));
  const root = realpathSync(temporary);
  roots.push(root);
  const project = path.join(root, 'project');
  const profile = path.join(root, 'profile');
  const installed = path.join(root, 'installed');
  mkdirSync(project);
  mkdirSync(profile);
  mkdirSync(path.join(installed, 'runtime'), { recursive: true });
  // Invoke the same real source CLI as the producer, outside the reviewed project.
  writeFileSync(
    path.join(installed, 'runtime/cli.js'),
    `await import(${JSON.stringify(path.join(repo, 'packages/cli/src/cli.ts'))});`,
  );
  for (const file of ['source.ts', 'generator.ts', 'stage-A.json', 'stage-B.json']) {
    const content = file.endsWith('.json') ? '{"fixed":true}\n' : 'export {};\n';
    writeFileSync(path.join(project, file), file === 'stage-B.json' ? stageB : content);
  }
  const bun = spawnSync(path.join(repo, 'scripts/dev'), ['bun', '-p', 'process.execPath'], {
    encoding: 'utf8',
  }).stdout.trim();
  const worker = path.join(root, 'worker.mjs');
  const completion = `
import {completeReviewJob} from ${JSON.stringify(path.join(repo, 'packages/cli/src/review/job.ts'))};
import {createResult} from ${JSON.stringify(path.join(repo, 'packages/cli/src/cli-protocol/result.ts'))};
completeReviewJob(process.cwd(),process.env.SAFEWORD_REVIEW_JOB_ID,createResult({state:'healthy',data:{
 command:'review run',status:'approved',author_agent:'codex',actual_reviewer:'claude',independence:${JSON.stringify(independence)},
 reviewer_output:{schema_version:1,dispatch_id:'synthetic-external-worker',reviewer_agent:'claude',verdict:'approve',summary:'Source fixture only',findings:[]}
}}));`;
  writeFileSync(
    worker,
    `import {spawnSync} from 'node:child_process';
const result=spawnSync(${JSON.stringify(bun)},['--no-env-file','-e',${JSON.stringify(completion)}],{env:process.env,cwd:process.cwd(),stdio:'inherit'});
process.exit(result.status??1);`,
  );
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', path.join(root, 'test-keys'));
  vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker);
  vi.stubEnv('SAFEWORD_PLUGIN_CLI', path.join(installed, 'runtime/cli.js'));
  const result = await startReviewJob({
    cwd: project,
    kind: 'quality-review',
    targets: ['source.ts', 'generator.ts'],
    context,
  });
  expect(result.data).toMatchObject({ status: 'approved', independence });
  const reviewId = (result.data as { review_id: string }).review_id;
  const locations = {
    project,
    profile,
    installed,
    artifacts: root,
    bun,
    environment: { ...process.env },
  };
  const required = {
    reviewId,
    targets: ['source.ts', 'generator.ts'],
    context: ['stage-A.json', 'stage-B.json'],
  };
  const directory = SAFEWORD_TRANSIENT_PATHS.find(item => item.endsWith('/reviews/'));
  if (!directory) throw new Error('Missing registered review directory');
  return {
    root: project,
    locations,
    required,
    job: path.join(project, directory, `${reviewId}.json`),
  };
}

it('refuses a genuine current approval that omitted staged B from review context', async () => {
  const fixture = await reviewedInputs(['stage-A.json']);
  expect(authenticatedReviewStatus(fixture.locations, []).data).toMatchObject({
    status: 'approved',
  });
  expect(() => authenticatedReviewStatus(fixture.locations, [], fixture.required)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE: staging review context incomplete',
  );
}, 30_000);

it('returns the normal approved receipt and its authenticated staged context', async () => {
  const fixture = await reviewedInputs();
  const observed = authenticatedReviewStatus(fixture.locations, [], fixture.required);
  expect(observed.receipt).toMatchObject({
    reviewId: fixture.required.reviewId,
    status: 'approved',
    kind: 'quality-review',
    independence: 'cross-agent',
    actualReviewer: 'claude',
  });
  expect(observed.context).toEqual(fixture.required.context);
  expect(observed.sourceFingerprint).toMatch(/^[\da-f]{64}$/u);
}, 30_000);

it('returns the actual normal captured context for a current approval', async () => {
  const fixture = await reviewedInputs();
  const captured = prepareReviewPacket(
    fixture.root,
    'quality-review',
    fixture.required.targets,
    fixture.required.context,
  );
  try {
    const observed = authenticatedReviewStatus(fixture.locations, [], fixture.required);
    expect(observed.context).toEqual(captured.packet.context_files?.map(file => file.path));
    expect(captured.sourceChanged()).toBe(false);
    expect(captured.snapshotChanged()).toBe(false);
  } finally {
    captured.cleanup();
  }
}, 30_000);

it('returns captured canonical paths rather than requested context aliases', async () => {
  const fixture = await reviewedInputs(['./stage-A.json', './stage-B.json']);
  const observed = authenticatedReviewStatus(fixture.locations, [], fixture.required);
  expect(observed.context).toEqual(['stage-A.json', 'stage-B.json']);
}, 30_000);

// The real owner refuses oversized context before dispatch; it cannot produce
// the requested "approved but omitted context" counterexample. This is capture
// characterization, not a fabricated RED or a native/independent review.
it('refuses an over-limit staged context before any normal approval', async () => {
  await expect(reviewedInputs(undefined, undefined, 'x'.repeat(262_145))).rejects.toMatchObject({
    code: 'REVIEW_TARGET_TOO_LARGE',
  });
}, 30_000);

it.each(['source.ts', 'generator.ts', 'stage-A.json', 'stage-B.json'])(
  'refuses actual reviewed-input drift: %s',
  async file => {
    const fixture = await reviewedInputs();
    writeFileSync(path.join(fixture.root, file), 'changed reviewed bytes');
    expect(() => authenticatedReviewStatus(fixture.locations, [], fixture.required)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: staging review not approved/current',
    );
  },
  30_000,
);

it('refuses a missing review instead of accepting caller-selected hashes', async () => {
  const fixture = await reviewedInputs();
  fixture.required.reviewId = randomUUID();
  expect(() => authenticatedReviewStatus(fixture.locations, [], fixture.required)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE: staging review missing',
  );
}, 30_000);

it.each(['targets', 'context'] as const)(
  'refuses empty required %s coverage',
  async field => {
    const fixture = await reviewedInputs();
    fixture.required[field] = [];
    expect(() => authenticatedReviewStatus(fixture.locations, [], fixture.required)).toThrow(
      `HOST_CONTRACT_PROOF_UNAVAILABLE: staging review ${field} incomplete`,
    );
  },
  30_000,
);

it('refuses an approval whose targets omit a required source input', async () => {
  const fixture = await reviewedInputs();
  fixture.required.targets.push('not-reviewed.ts');
  expect(() => authenticatedReviewStatus(fixture.locations, [], fixture.required)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE: staging review targets incomplete',
  );
}, 30_000);

it('refuses reduced review coverage for externally vetted staging', async () => {
  const fixture = await reviewedInputs(undefined, 'reduced');
  expect(() => authenticatedReviewStatus(fixture.locations, [], fixture.required)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE: staging review not independent',
  );
}, 30_000);

it('does not accept a self-populated context in an invalidated normal job', async () => {
  const fixture = await reviewedInputs(['stage-A.json']);
  const record = JSON.parse(readFileSync(fixture.job, 'utf8')) as { context: string[] };
  record.context.push('stage-B.json'); // Deliberately DO NOT sign or recreate integrity.
  writeFileSync(fixture.job, JSON.stringify(record));
  expect(() => authenticatedReviewStatus(fixture.locations, [], fixture.required)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE: staging review not approved/current',
  );
}, 30_000);

it('refuses a record changed during the real status read', async () => {
  const fixture = await reviewedInputs();
  const proxy = path.join(fixture.locations.installed, 'runtime/cli.js');
  writeFileSync(
    proxy,
    `import {spawnSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
const result=spawnSync(${JSON.stringify(fixture.locations.bun)},['--no-env-file',
 ${JSON.stringify(path.join(repo, 'packages/cli/src/cli.ts'))},...process.argv.slice(2)],{env:process.env,encoding:'utf8'});
process.stdout.write(result.stdout);appendFileSync(${JSON.stringify(fixture.job)},' ');
process.exit(result.status??1);`,
  );
  expect(() => authenticatedReviewStatus(fixture.locations, [], fixture.required)).toThrow(
    'HOST_CONTRACT_PROOF_UNAVAILABLE: staging review changed during validation',
  );
}, 30_000);

function capturedGroup(isolated: boolean, fault?: string): InvocationScenarioResult[] {
  return codexInternalCases().map(row => ({
    name: row.scenario,
    line: row.line,
    steps: [
      ...Array.from({ length: row.stepCount }, () => ({ result: { status: 'passed' } })),
      {
        hidden: true,
        keyword: 'After',
        result: { status: 'passed' },
        embeddings: preservationEmbedding(row.scenario).map(embedding => {
          const value = JSON.parse(Buffer.from(embedding.data, 'base64').toString()) as {
            observation: Record<string, boolean>;
          };
          if (isolated)
            Object.assign(value.observation, {
              fiveTrustedBindingsUnchanged: false,
              persistedHookTrustBypassed: true,
              originalFiveTrustedBindingsUnchanged: true,
              fiveEnabledBindingsUnchanged: true,
            });
          if (fault) value.observation[fault] = false;
          return { ...embedding, data: Buffer.from(JSON.stringify(value)).toString('base64') };
        }),
      },
    ],
  }));
}

// Captured classifier doubles only. The native entrypoint separately verifies
// the actual preservation files/child paths; these synthetic paths cannot pass it.
it('accepts the approved isolated preservation projection without asserting child trust', () => {
  expect(invocationResult(capturedGroup(false), 0)).toBe(0);
  expect(invocationResult(capturedGroup(true), 0)).toBe(0);
});

it('keeps the normal child-trust requirement', () => {
  expect(invocationResult(capturedGroup(false, 'fiveTrustedBindingsUnchanged'), 0)).toBe(3);
});

it.each([
  'originalConfigUnchanged',
  'originalRuntimeUnchanged',
  'originalBundleUnchanged',
  'persistedHookTrustBypassed',
  'originalFiveTrustedBindingsUnchanged',
  'fiveEnabledBindingsUnchanged',
])('refuses incomplete isolated preservation: %s', fault => {
  expect(invocationResult(capturedGroup(true, fault), 0)).toBe(3);
});
