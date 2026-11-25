import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { trustedEnvironment } from '../../templates/hooks/lib/safeword-cli.js';
import {
  receiptReviewCandidates,
  reviewChildEnvironment,
} from '../../templates/hooks/run-review.js';
import {
  bundleInventory,
  type HookObservation,
  nativeWorkflowEnvironment,
} from './codex-internal-workflows.js';
import type { CodexGuardFixture } from './codex-native-continuation.js';
import { authenticatedReviewStatus } from './codex-review-authentication.js';
import type { CodexWorkflowRuntimeActor } from './codex-workflow-runtime.js';

export type WorkflowPair = ReturnType<CodexWorkflowRuntimeActor['stageRevisions']>;
export interface WorkflowSelection {
  caseId: string;
  arm: string;
}
export interface WorkflowReview extends WorkflowSelection {
  manifest: string;
  reviewId: string;
  rawDeltaReviewId?: string;
}
const repo = path.resolve(import.meta.dirname, '../../../..');
const unavailable = 'HOST_CONTRACT_PROOF_UNAVAILABLE: isolated workflow';
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
export const workflowReviewCollaborators = [
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
export const workflowReviewCallers = [
  'src/review/coordinator.ts',
  'tests/helpers/codex-wiring-grade.ts',
  'tests/helpers/codex-reviewed-workflow.ts',
];
export const workflowReviewSources = [
  ...readdirSync(path.join(repo, 'packages/cli/tests/helpers'))
    .filter(name => /^codex-.*\.(?:ts|py)$/u.test(name))
    .toSorted((left, right) => left.localeCompare(right))
    .map(name => `packages/cli/tests/helpers/${name}`),
  'packages/cli/scripts/generate-codex-plugin.ts',
  'packages/cli/scripts/check-codex-internal-workflows.ts',
  'packages/cli/tests/fixtures/host-contract/codex-workflow-runtime.steps.ts',
  'packages/cli/tests/fixtures/host-contract/codex-workflow-closure.mjs',
  'packages/cli/tests/fixtures/host-contract/native-contract-cases.ts',
  'packages/cli/tests/helpers/contract-repo-fixture.ts',
  'steps/consistent-host-contract.steps.ts',
  'steps/world.ts',
  'packages/cli/src/cli.ts',
  'packages/cli/src/review/command.ts',
  'packages/cli/src/review/coordinator.ts',
  'packages/cli/src/review/packet.ts',
  'packages/cli/src/review/job.ts',
  'packages/cli/src/review/planning-context-identity.ts',
  'packages/cli/templates/hooks/lib/read-receipt.ts',
  'packages/cli/templates/hooks/lib/safeword-cli.ts',
  'packages/cli/templates/hooks/run-review.ts',
];

export function workflowReviewTargets(selection?: WorkflowSelection): string[] {
  return selection?.caseId === 'headless-propagation'
    ? [
        ...workflowReviewSources,
        'packages/cli/tests/helpers/headless-codex-propagation.ts',
        'packages/cli/scripts/lib/resource-propagation-run.ts',
        'packages/cli/scripts/lib/resource-propagation.ts',
        'packages/cli/scripts/lib/propagation-policy-phases.ts',
        'packages/cli/scripts/lib/propagation-policy-grade.ts',
        'packages/cli/scripts/lib/propagation-settings.ts',
        'packages/cli/scripts/run-host-contract-proof.ts',
        'packages/cli/scripts/generated-tree-differences.ts',
        'packages/cli/tests/helpers/propagation-source.ts',
        'packages/cli/tests/fixtures/host-contract/native-runtime-observer.mjs',
      ]
    : workflowReviewSources;
}

const propagationFixtureOwners = new Set([
  'packages/cli/templates/skills/explain/SKILL.md',
  'packages/cli/templates/skills/explain/HOST_CONTRACT_GUIDE.md',
  'packages/cli/templates/hooks/audit-principle-trace.ts',
  'packages/cli/templates/hooks/lib/done-gate.ts',
]);

/** Complete raw A/B deltas are captured per owner. Generated packages retain
 * separate complete inventories; no differing input bytes are omitted. */
export function workflowInputDelta(
  stages: readonly { source: string; inputs: string; inventory: string }[],
  selection?: WorkflowSelection,
) {
  assert.equal(stages.length, 2, unavailable);
  const inventories = stages.map(stage => {
    const input = JSON.parse(readFileSync(stage.inputs, 'utf8')) as {
      roots: Record<string, Record<string, string>>;
      metadata: Record<string, string>;
    };
    return {
      ...input.metadata,
      ...Object.fromEntries(
        Object.entries(input.roots).flatMap(([root, files]) =>
          Object.entries(files).map(([file, hash]) => [`${root}/${file}`, hash]),
        ),
      ),
    };
  });
  const [a, b] = inventories;
  assert.ok(a && b, unavailable);
  const files = Object.keys(a).toSorted((left, right) => left.localeCompare(right));
  assert.deepEqual(
    files,
    Object.keys(b).toSorted((left, right) => left.localeCompare(right)),
    `${unavailable}: input keysets differ`,
  );
  const inputs: Record<string, { A: string; B: string }> = {};
  for (const relative of files) {
    if (a[relative] === b[relative]) {
      const baseline = path.join(repo, relative);
      if (existsSync(baseline) && digest(baseline) === a[relative]) continue;
      // An unchanged fixture marker across a pair still differs from the live
      // baseline and must be captured as raw A/B bytes in that pair's review.
      assert.ok(
        selection?.caseId === 'headless-propagation' && propagationFixtureOwners.has(relative),
        `${unavailable}: baseline input differs: ${relative}`,
      );
    }
    const pairedFiles = stages.map((stage, index) => {
      const file = path.join(stage.source, relative);
      const raw = readFileSync(file, 'utf8');
      assert.equal(
        createHash('sha256').update(raw).digest('hex'),
        inventories[index]?.[relative],
        unavailable,
      );
      return raw;
    });
    const [A, B] = pairedFiles;
    assert.ok(A !== undefined && B !== undefined, unavailable);
    inputs[relative] = { A, B };
  }
  const first = stages[0];
  assert.ok(first, unavailable);
  const rawFiles = Object.fromEntries(
    Object.keys(inputs).map(relative => [
      relative,
      path.join(path.dirname(first.source), 'input-delta', `${relative}.json`),
    ]),
  );
  return { inputs, rawFiles, generatedInventories: stages.map(stage => stage.inventory) };
}

/** Fixed roles over the owned descriptor; preparation does not grant authority. */
export function workflowReviewGroups(
  pair: Pick<WorkflowPair, 'project' | 'targets' | 'context'> & {
    stages: readonly Pick<WorkflowPair['stages'][number], 'source' | 'inventory' | 'inputs'>[];
  },
): readonly [
  { role: 'code'; targets: string[]; context: string[] },
  { role: 'raw-deltas'; targets: string[]; context: string[] },
] {
  const index = path.join(pair.project, 'canonical-input-delta.json');
  const context = [
    ...pair.stages.flatMap(stage => [stage.inventory, stage.inputs]),
    index,
    path.join(pair.project, 'staged-inputs.json'),
  ];
  const first = pair.stages[0];
  assert.ok(first, unavailable);
  const staged = (file: string) => path.join(first.source, 'packages/cli', file);
  return [
    {
      role: 'code',
      targets: pair.targets,
      context,
    },
    {
      role: 'raw-deltas',
      targets: pair.context.filter(file => !context.includes(file)),
      context: [...context, ...workflowReviewCallers.map(staged)],
    },
  ] as const;
}

/** Check the owned staged bytes without granting hook trust or review authority. */
export function preparedWorkflowPair(
  fixture: CodexGuardFixture,
  review: WorkflowSelection & { manifest: string },
) {
  const manifest = realpathSync(review.manifest);
  assert.ok(manifest.startsWith(`${realpathSync(fixture.root)}/internal-workflows-`), unavailable);
  const pair = JSON.parse(readFileSync(manifest, 'utf8')) as WorkflowPair;
  assert.deepEqual(
    pair.provisioning,
    {
      root: realpathSync(fixture.root),
      profile: realpathSync(fixture.profile),
      project: realpathSync(fixture.project),
      installedPath: realpathSync(fixture.installedPath),
      binary: realpathSync(fixture.binary),
      binarySha256: digest(fixture.binary),
      originalConfigSha256: digest(path.join(fixture.profile, 'config.toml')),
      originalPackage: bundleInventory(fixture.installedPath),
    },
    `${unavailable}: provisioning changed`,
  );
  assert.equal(manifest, path.join(pair.project, 'staged-inputs.json'), unavailable);
  assert.equal(pair.mode, 'unsigned-preparation-only', unavailable);
  assert.equal(pair.admissionEligible, false, unavailable);
  assert.deepEqual(pair.ownership, { caseId: review.caseId, arm: review.arm }, unavailable);
  assert.deepEqual(
    pair.stages.map(stage => stage.label),
    ['A', 'B'],
    unavailable,
  );
  for (const stage of pair.stages) {
    assert.equal(realpathSync(stage.source), path.join(pair.project, stage.label), unavailable);
    assert.equal(
      stage.packageRoot,
      path.join(stage.source, 'packages/cli/codex-plugin'),
      unavailable,
    );
    assert.equal(
      stage.inventory,
      path.join(pair.project, `${stage.label}-package-inventory.json`),
      unavailable,
    );
    assert.equal(
      stage.inputs,
      path.join(pair.project, `${stage.label}-generation-inputs.json`),
      unavailable,
    );
    assert.deepEqual(
      bundleInventory(stage.packageRoot),
      JSON.parse(readFileSync(stage.inventory, 'utf8')),
      unavailable,
    );
    const inputs = JSON.parse(readFileSync(stage.inputs, 'utf8')) as {
      roots: Record<string, Record<string, string>>;
      metadata: Record<string, string>;
    };
    assert.deepEqual(
      Object.keys(inputs.roots),
      ['packages/cli/src', 'packages/cli/templates', 'packages/cli/scripts', 'scripts'],
      unavailable,
    );
    for (const [relative, inventory] of Object.entries(inputs.roots))
      assert.deepEqual(
        bundleInventory(path.join(stage.source, relative)),
        inventory,
        `${unavailable}: input tree differs`,
      );
    for (const [relative, hash] of Object.entries(inputs.metadata))
      assert.equal(digest(path.join(stage.source, relative)), hash, unavailable);
    assert.deepEqual(
      Object.keys(inputs.metadata),
      [
        'package.json',
        'bun.lock',
        'mise.toml',
        'packages/cli/package.json',
        'packages/cli/codex-plugin/.codex-plugin/plugin.json',
      ],
      unavailable,
    );
    for (const relative of [
      ...workflowReviewTargets(review),
      ...workflowReviewCollaborators.map(file => `packages/cli/${file}`),
    ])
      assert.equal(
        digest(path.join(stage.source, relative)),
        digest(path.join(repo, relative)),
        `${unavailable}: capture/source version differs`,
      );
  }
  const a = pair.stages[0];
  assert.ok(a, unavailable);
  const delta = workflowInputDelta(pair.stages, review);
  const deltaPath = path.join(pair.project, 'canonical-input-delta.json');
  assert.deepEqual(
    JSON.parse(readFileSync(deltaPath, 'utf8')),
    { inputs: delta.rawFiles, generatedInventories: delta.generatedInventories },
    `${unavailable}: input delta differs`,
  );
  for (const [relative, file] of Object.entries(delta.rawFiles))
    assert.deepEqual(
      JSON.parse(readFileSync(file, 'utf8')),
      delta.inputs[relative],
      `${unavailable}: raw input delta differs`,
    );
  const targets = workflowReviewTargets(review).map(relative => path.join(a.source, relative));
  const context = [
    ...pair.stages.flatMap(stage => [stage.inventory, stage.inputs]),
    ...Object.values(delta.rawFiles),
    path.join(pair.project, 'canonical-input-delta.json'),
    manifest,
    ...workflowReviewCollaborators.map(file => path.join(a.source, 'packages/cli', file)),
  ];
  assert.deepEqual(pair.targets, targets, `${unavailable}: source targets differ`);
  assert.deepEqual(pair.context, context, unavailable);
  assert.equal(
    pair.coordinator,
    path.join(path.dirname(pair.project), 'coordinator/runtime/cli.js'),
    unavailable,
  );
  assert.equal(digest(pair.coordinator), pair.coordinatorSha256, unavailable);
  const coordinatorRoot = path.dirname(path.dirname(pair.coordinator));
  assert.deepEqual(bundleInventory(coordinatorRoot), bundleInventory(a.packageRoot), unavailable);
  return pair;
}

/** Use the existing receipt verifiers for the independent behavior review. */
export function reviewedWorkflowPair(
  fixture: CodexGuardFixture,
  review: WorkflowReview,
  artifacts: string,
) {
  const pair = preparedWorkflowPair(fixture, review);
  const original = process.env.SAFEWORD_PLUGIN_CLI;
  try {
    // Synchronous, scoped selection of the already vetted distribution. Never
    // let the older operational source guard answer a staged review question.
    process.env.SAFEWORD_PLUGIN_CLI = pair.coordinator;
    const first = receiptReviewCandidates(pair.project)[0];
    assert.ok(first, `${unavailable}: verifier route missing`);
    assert.ok(first[1].includes(pair.coordinator), `${unavailable}: verifier route differs`);
    const status = spawnSync(
      first[0],
      [...first[1], 'review', 'status', review.reviewId, '--cwd', pair.project, '--json'],
      {
        cwd: first[2],
        env: reviewChildEnvironment(trustedEnvironment(pair.project), [
          'review',
          'status',
          review.reviewId,
          '--json',
        ]),
        encoding: 'utf8',
        timeout: 30_000,
      },
    );
    writeFileSync(
      path.join(artifacts, 'staged-review-status.json'),
      JSON.stringify(
        {
          status: status.status,
          stdout: status.stdout,
          stderr: status.stderr,
          error: status.error?.message,
        },
        undefined,
        2,
      ),
    );
    const authenticate = (
      reviewId: string,
      group: ReturnType<typeof workflowReviewGroups>[number],
    ) =>
      authenticatedReviewStatus(
        {
          project: pair.project,
          profile: fixture.root,
          installed: path.dirname(path.dirname(pair.coordinator)),
          artifacts,
        },
        [],
        { reviewId, targets: [...group.targets], context: group.context, exact: true },
      );
    const [code, raw] = workflowReviewGroups(pair);
    const approved = authenticate(review.reviewId, code);
    assert.equal(status.status, 0, `${unavailable}: review status process`);
    assert.ok(review.rawDeltaReviewId, `${unavailable}: raw-deltas review missing`);
    assert.notEqual(review.reviewId, review.rawDeltaReviewId, `${unavailable}: reviews duplicate`);
    const rawApproved = authenticate(review.rawDeltaReviewId, raw);
    writeFileSync(
      path.join(artifacts, 'staged-review-authentication.json'),
      JSON.stringify(
        {
          review,
          approved,
          rawApproved,
          coordinator: pair.coordinator,
          coordinatorSha256: pair.coordinatorSha256,
        },
        undefined,
        2,
      ),
    );
  } finally {
    if (original === undefined) Reflect.deleteProperty(process.env, 'SAFEWORD_PLUGIN_CLI');
    else process.env.SAFEWORD_PLUGIN_CLI = original;
  }
  return pair;
}

/** Sync turn APIs reuse the ONE async native RPC owner in a child process. */
export function workflowHookInventory(
  fixture: CodexGuardFixture,
  artifacts: string,
  label: string,
): HookObservation[] {
  const program = `import {nativeHooks} from ${JSON.stringify(path.join(repo, 'packages/cli/tests/helpers/codex-internal-workflows.ts'))}; console.log(JSON.stringify(await nativeHooks(...JSON.parse(process.argv[1]))));`;
  const result = spawnSync(
    'bun',
    [
      '--no-env-file',
      '-e',
      program,
      JSON.stringify([fixture.binary, fixture.profile, fixture.project]),
    ],
    {
      cwd: fixture.project,
      env: nativeWorkflowEnvironment(fixture.profile),
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
  writeFileSync(
    path.join(artifacts, `${label}-inventory.json`),
    JSON.stringify(
      {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error?.message,
      },
      undefined,
      2,
    ),
  );
  assert.equal(result.status, 0, `${unavailable}: inventory process: ${result.stderr}`);
  return JSON.parse(result.stdout) as HookObservation[];
}

export function requireWorkflowBindings(
  hooks: HookObservation[],
  installed: string,
  trusted = false,
): void {
  assert.deepEqual(
    hooks.map(h => h.eventName).toSorted((a, b) => a.localeCompare(b)),
    ['postToolUse', 'preToolUse', 'sessionStart', 'stop', 'userPromptSubmit'],
    `${unavailable}: events differ`,
  );
  for (const hook of hooks) {
    assert.equal(hook.enabled, true, `${unavailable}: disabled event`);
    assert.equal(
      realpathSync(hook.sourcePath),
      path.join(realpathSync(installed), 'hooks.json'),
      `${unavailable}: foreign source`,
    );
    if (trusted)
      assert.equal(hook.trustStatus, 'trusted', `${unavailable}: original trust differs`);
  }
}
