import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { parsePlanningContract } from '../packages/cli/src/planning/phase-contract.js';
import { parseDeliveryPlanContract } from '../packages/cli/src/execution-plan/delivery-checklist.js';
import { extractExecutionPlanReviewRubric } from '../packages/cli/src/review/execution-plan-rubric.js';
import { extractPlanReviewRubric } from '../packages/cli/src/review/plan-rubric.js';
import {
  admitThroughInstalledCli,
  featureFixture,
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
  canonicalChanged?: boolean;
}

function executionAdmission(state: DependencyState): string {
  const result = spawnSync('bun', [path.join(state.runtime, 'runtime/hooks/pre-tool-quality.ts')], {
    cwd: state.root,
    encoding: 'utf8',
    timeout: 30_000,
    input: JSON.stringify({
      session_id: 'r9-dependency',
      tool_name: 'Edit',
      tool_input: {
        file_path: path.join(state.root, ticketDirectory, 'ticket.md'),
        old_string: 'phase: plan-execution',
        new_string: 'phase: implement',
      },
    }),
    env: {
      ...process.env,
      XDG_STATE_HOME: path.join(state.root, '.review-keys'),
      CLAUDE_PROJECT_DIR: state.root,
      CLAUDE_PLUGIN_ROOT: state.runtime,
    },
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
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
        .replaceAll('features/current-context.feature', 'features/feature.feature')
        .replace('phase: plan-implementation', 'phase: plan-execution');
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
  // Dispatch and currency reconstruction use the same installed distribution.
  await admitThroughInstalledCli(async (args, options) => {
    const reviewed = spawnSync('bun', [path.join(runtime, 'runtime/cli.js'), ...args], {
      cwd: options.cwd,
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        ...process.env,
        ...options.env,
        PATH: `${options.env.PATH}:${process.env.PATH ?? ''}`,
        XDG_STATE_HOME: path.join(root, '.review-keys'),
        CLAUDE_PLUGIN_ROOT: runtime,
      },
    });
    assert.equal(reviewed.error, undefined, reviewed.error?.message);
    return {
      exitCode: reviewed.status ?? 1,
      stdout: reviewed.stdout,
      stderr: reviewed.stderr,
    };
  }, root);
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
  assert.equal(
    executionAdmission(state),
    '',
    'the current authenticated receipts must admit coding',
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
  const file = implementation ? 'PLAN_IMPLEMENTATION.md' : 'PLAN_EXECUTION.md';
  const before = '- **Purpose:**';
  const after = '- **Purpose:**   ';
  const extract = implementation ? extractPlanReviewRubric : extractExecutionPlanReviewRubric;
  // Change the actual canonical and installed authoring files, leaving the
  // previously approved runtime and reviewer copy untouched.
  for (const directory of ['templates/skills/bdd', 'skills/bdd']) {
    const contract = path.join(state.runtime, directory, file);
    const content = readFileSync(contract, 'utf8');
    assert.ok(content.includes(before), `the ${file} contract must declare its purpose`);
    const changed = content.replace(before, () => after);
    assert.notEqual(extract(changed), extract(content), 'the exact bounded contract must change');
    writeFileSync(contract, changed);
  }
  state.canonicalChanged = true;
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
    if (state.canonicalChanged) {
      const output = executionAdmission(state);
      assert.notEqual(output, '', 'a changed canonical contract must not admit coding');
      const denied = JSON.parse(output);
      assert.equal(denied.hookSpecificOutput?.permissionDecision, 'deny', output);
      const requiredApproval =
        state.observed[0] === 'stale'
          ? 'An accepted implementation approach is required before execution.'
          : 'An admitted Delivery Checklist is required before execution.';
      assert.ok(
        denied.hookSpecificOutput?.permissionDecisionReason?.startsWith(requiredApproval),
        output,
      );
    }
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
