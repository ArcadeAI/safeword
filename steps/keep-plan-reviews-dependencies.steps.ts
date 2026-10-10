import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { EXECUTION_PLAN_REVIEW_RUBRIC } from '../packages/cli/src/review/execution-plan-rubric.generated.js';
import { PLAN_REVIEW_RUBRIC } from '../packages/cli/src/review/plan-rubric.generated.js';
import { parsePlanningContract } from '../packages/cli/src/planning/phase-contract.js';
import { parseDeliveryPlanContract } from '../packages/cli/src/execution-plan/delivery-checklist.js';
import {
  admitThroughInstalledCli,
  featureFixture,
  installedReviewCli,
} from '../packages/cli/tests/fixtures/execution-review.js';
import { cleanupTrustedReviewerDirectories } from '../packages/cli/tests/review-fixtures.js';
import type { SafewordWorld } from './world.js';
import { fixtureProject } from './keep-plan-reviews-installed-context.steps.js';

const ticketDirectory = '.project/tickets/ABC123-feature';
const states = new WeakMap<SafewordWorld, DependencyState>();

interface DependencyState {
  root: string;
  runtime: string;
  implementation: string;
  execution: string;
  observed?: readonly string[];
}

function reviewStatuses(state: DependencyState): readonly string[] {
  return [state.implementation, state.execution].map(id => {
    const result = spawnSync(
      'bun',
      [path.join(state.runtime, 'runtime/cli.js'), 'review', 'status', id, '--json'],
      {
        cwd: state.root,
        encoding: 'utf8',
        timeout: 30_000,
        env: {
          ...process.env,
          XDG_STATE_HOME: path.join(state.root, '.review-keys'),
          CLAUDE_PLUGIN_ROOT: state.runtime,
        },
      },
    );
    assert.equal(result.error, undefined, result.error?.message);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.errors, [], `${result.stdout}\n${result.stderr}`);
    assert.ok(output.data.review_identity, 'the receipts must carry owned planning identities');
    assert.ok(['approved', 'stale'].includes(output.data.status), result.stdout);
    return output.data.status;
  });
}

async function currentReceipts(world: SafewordWorld): Promise<void> {
  const root = featureFixture();
  const runtime = mkdtempSync(path.join(tmpdir(), 'safeword-r9-dependency-'));
  const state = { root, runtime, implementation: '', execution: '' };
  states.set(world, state);
  // Semantic dependencies belong to an owned v1 planning ticket, not a legacy plan.
  const owned = fixtureProject();
  try {
    for (const file of ['ticket.md', 'spec.md', 'impl-plan.md']) {
      const content = readFileSync(
        path.join(owned, '.project/tickets/CTX123-current-context', file),
        'utf8',
      )
        .replaceAll('CTX123', 'ABC123')
        .replaceAll('features/current-context.feature', 'features/feature.feature');
      writeFileSync(path.join(root, ticketDirectory, file), content);
    }
    writeFileSync(
      path.join(root, 'features/feature.feature'),
      readFileSync(path.join(owned, 'features/current-context.feature'), 'utf8'),
    );
  } finally {
    rmSync(owned, { recursive: true, force: true });
  }
  cpSync(path.resolve(import.meta.dirname, '../plugin'), runtime, { recursive: true });
  await admitThroughInstalledCli(installedReviewCli(root), root);
  const ledger = readFileSync(path.join(root, '.project/skill-invocations.log'), 'utf8');
  for (const [field, kind] of [
    ['implementation', 'plan-implementation'],
    ['execution', 'plan-execution'],
  ] as const) {
    const row = ledger.split('\n').find(line => line.includes(`:phase@${kind} `));
    assert.ok(row);
    const id = /review-id:(\S+)/u.exec(row)?.[1];
    assert.ok(id);
    state[field] = id;
  }
  assert.deepEqual(
    reviewStatuses(state),
    ['approved', 'approved'],
    'both authentic receipts must start current',
  );
}

Given(
  'both plans have current review receipts',
  { timeout: 60_000 },
  async function (this: SafewordWorld) {
    await currentReceipts(this);
  },
);

Given(
  'current plan-review receipts and a canonical Execution Planning contract that declares accepted Implementation Plan changes invalidate both plan reviews',
  { timeout: 60_000 },
  async function (this: SafewordWorld) {
    await currentReceipts(this);
    const state = states.get(this);
    assert.ok(state);
    const contract = readFileSync(
      path.join(state.runtime, 'templates/skills/bdd/PLAN_EXECUTION.md'),
      'utf8',
    );
    const parsed = parsePlanningContract('plan-execution', contract);
    assert.equal(parsed.phase, 'plan-execution');
    assert.ok('upstreamImplementationInvalidation' in parsed);
    assert.equal(parsed.upstreamImplementationInvalidation, 'both_plan_reviews');
  },
);

function changeCanonicalContract(state: DependencyState, implementation: boolean): void {
  const prefix = implementation ? 'PLAN' : 'EXECUTION_PLAN';
  const rubric = implementation ? PLAN_REVIEW_RUBRIC : EXECUTION_PLAN_REVIEW_RUBRIC;
  const runtime = path.join(state.runtime, 'runtime/cli.js');
  const bundle = readFileSync(runtime, 'utf8');
  const start = bundle.indexOf(`var ${prefix}_REVIEW_RUBRIC = \``);
  const end = bundle.indexOf(`${prefix}_REVIEW_RUBRIC_SHA256`, start);
  assert.ok(start >= 0 && end > start);
  const before = '- **Purpose:**';
  const after = '- **Purpose:**   ';
  const block = bundle.slice(start, end);
  assert.ok(block.includes(before));
  const digest = (content: string) => createHash('sha256').update(content).digest('hex');
  const oldHash = digest(rubric);
  const newHash = digest(rubric.replace(before, () => after));
  assert.notEqual(oldHash, newHash);
  assert.ok(bundle.includes(`${prefix}_REVIEW_RUBRIC_SHA256 = "${oldHash}"`));
  writeFileSync(
    runtime,
    (bundle.slice(0, start) + block.replace(before, () => after) + bundle.slice(end)).replace(
      `${prefix}_REVIEW_RUBRIC_SHA256 = "${oldHash}"`,
      () => `${prefix}_REVIEW_RUBRIC_SHA256 = "${newHash}"`,
    ),
  );
}

function changeFile(
  state: DependencyState,
  file: string,
  change: (content: string) => string,
): void {
  const absolute = path.join(state.root, file);
  const before = readFileSync(absolute, 'utf8');
  const after = change(before);
  assert.notEqual(after, before, `the ${file} mutation must actually change bytes`);
  writeFileSync(absolute, after);
}

const mutations: Record<string, (state: DependencyState) => void> = {
  'accepted behavior': state =>
    changeFile(state, 'features/feature.feature', content =>
      content.replace(
        'Then the current context reaches review',
        'Then changed acceptance reaches review',
      ),
    ),
  'accepted scope': state =>
    changeFile(state, `${ticketDirectory}/ticket.md`, content =>
      content.replace(
        'scope: preserve authenticated approval',
        'scope: change accepted approval boundary',
      ),
    ),
  'canonical Implementation Planning contract bytes change': state =>
    changeCanonicalContract(state, true),
  'only canonical Execution Planning contract bytes change': state =>
    changeCanonicalContract(state, false),
  "only the accepted Implementation Plan's formatting bytes": state =>
    changeFile(state, `${ticketDirectory}/impl-plan.md`, content => `${content}\n`),
  'only the Execution Plan bytes, including formatting-only bytes outside normalized checklist progress cells':
    state => changeFile(state, `${ticketDirectory}/execution-plan.md`, content => `${content}\n`),
  "only whitespace inside a reviewed Execution Plan checklist row's normalized progress cells":
    state =>
      changeFile(state, `${ticketDirectory}/execution-plan.md`, content =>
        content.replace('| open | missing |  |  |', '|   open   |   missing   |   |   |'),
      ),
  "only ordinary progress in a reviewed Execution Plan checklist row's Disposition, Evidence class, Revision, or final evidence cell":
    state =>
      changeFile(state, `${ticketDirectory}/execution-plan.md`, content =>
        content.replace(
          '| open | missing |  |  |',
          '| complete | current_revision_real_boundary | fixture-revision | receipt:fixture-progress |',
        ),
      ),
};

for (const [description, mutate] of Object.entries(mutations)) {
  When(`${description} occurs`, function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    mutate(state);
    // A progress locator is fixture input, not a claim of authenticated delivery proof.
    const parsed = parseDeliveryPlanContract(
      readFileSync(path.join(state.root, ticketDirectory, 'execution-plan.md'), 'utf8'),
    );
    assert.ok(parsed.ok, 'each mutation must preserve a structurally valid Delivery Checklist');
    state.observed = reviewStatuses(state);
  });
}

When('the accepted Implementation Plan changes semantically', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state);
  changeFile(state, `${ticketDirectory}/impl-plan.md`, content =>
    content.replace(
      'Use the current review receipt to guard the transition.',
      'Use a different authenticated review receipt to guard the transition.',
    ),
  );
  state.observed = reviewStatuses(state);
});

const expectedStatuses: Record<string, readonly string[]> = {
  'both plan reviews are invalidated': ['stale', 'stale'],
  'only the Execution Plan review is invalidated': ['approved', 'stale'],
  'only the Implementation Plan review is invalidated and the Execution Plan review remains current':
    ['stale', 'approved'],
  'neither plan review is invalidated': ['approved', 'approved'],
};

Then(
  /^(both plan reviews are invalidated|only the Execution Plan review is invalidated|only the Implementation Plan review is invalidated and the Execution Plan review remains current|neither plan review is invalidated)$/,
  function (this: SafewordWorld, result: string) {
    const state = states.get(this);
    assert.ok(state?.observed);
    assert.deepEqual(state.observed, expectedStatuses[result], result);
  },
);

After(function (this: SafewordWorld) {
  const state = states.get(this);
  if (state) {
    rmSync(state.root, { recursive: true, force: true });
    rmSync(state.runtime, { recursive: true, force: true });
    cleanupTrustedReviewerDirectories();
  }
  states.delete(this);
});
