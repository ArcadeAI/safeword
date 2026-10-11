import { strict as assert } from 'node:assert';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { createTrustedReviewerDirectory } from '../packages/cli/tests/review-fixtures.js';
import { getTemplatesDirectory } from '../packages/cli/src/utils/fs.js';
import { fixtureProject, reviewerExecutable } from './keep-plan-reviews-installed-context.steps.js';
import type { SafewordWorld } from './world.js';

const cli = path.resolve(import.meta.dirname, '../packages/cli/src/cli.ts');
const pluginRoot = path.resolve(import.meta.dirname, '../plugin');
const ticket = '.project/tickets/CTX123-current-context';
const target = `${ticket}/impl-plan.md`;

interface CorrectionState {
  root: string;
  reviewer: string;
  environment: NodeJS.ProcessEnv;
  initialReviewId?: string;
  freshReviewId?: string;
  gate?: SpawnSyncReturns<string>;
}
const states = new WeakMap<SafewordWorld, CorrectionState>();

function command(state: CorrectionState, args: string[]) {
  return spawnSync('bun', [cli, ...args, '--json', '--no-input'], {
    cwd: state.root,
    env: state.environment,
    encoding: 'utf8',
    timeout: 60_000,
  });
}

function review(state: CorrectionState, status: 'approved' | 'changes_requested'): string {
  const result = command(state, ['review', 'run', 'plan-implementation', target]);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.errors, [], `${result.stdout}\n${result.stderr}`);
  assert.equal(output.data.status, status, result.stdout);
  assert.equal(typeof output.data.review_id, 'string');
  return output.data.review_id;
}

function rejectedPlan(world: SafewordWorld): CorrectionState {
  const root = fixtureProject();
  const reviewer = createTrustedReviewerDirectory('safeword-r11-currency-');
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${reviewer}:${process.env.PATH ?? ''}`,
    CLAUDE_PROJECT_DIR: root,
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    CLAUDE_SESSION_ID: 'r11-currency',
    SAFEWORD_REVIEW_KEY_ROOT: path.join(root, '.review-keys'),
    CLAUDE_CONFIG_DIR: path.join(root, 'claude'),
    SAFEWORD_SKIP_INSTALL: '1',
    SAFEWORD_SKIP_SKILLS: '1',
    SAFEWORD_AGENT_RUNTIME: 'claude',
    SAFEWORD_NO_UPDATE_CHECK: '1',
  };
  delete environment.SAFEWORD_AUTHOR_MODEL;
  const state: CorrectionState = { root, reviewer, environment };
  states.set(world, state);
  const installed = command(state, ['install', '--agents=claude', '--no-modify', '--cwd', root]);
  const installation = JSON.parse(installed.stdout);
  assert.deepEqual(installation.errors, [], `${installed.stdout}\n${installed.stderr}`);
  assert.ok(
    installation.findings.some(
      (finding: { code: string }) => finding.code === 'SETUP_POSTCONDITION_VERIFIED',
    ),
  );
  const configPath = path.join(root, '.safeword/config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  writeFileSync(
    configPath,
    JSON.stringify({
      ...config,
      reviewGate: true,
      crossAgentReview: 'prefer',
      crossAgentReviewRoutes: { claude: [{ reviewer: 'opencode' }] },
    }),
  );
  reviewerExecutable(reviewer);
  const executable = path.join(reviewer, 'opencode');
  const source = readFileSync(executable, 'utf8');
  assert.ok(source.includes("verdict: 'approve'"));
  assert.ok(source.includes('findings: []'));
  writeFileSync(
    executable,
    source
      .replace("verdict: 'approve'", "verdict: 'request_changes'")
      .replace(
        'findings: []',
        "findings: [{ severity: 'error', message: 'Accepted Rule approval.BU1.R1 requires authenticated current approval; explicitly reject missing authentication before advancing.' }]",
      ),
  );
  state.initialReviewId = review(state, 'changes_requested');
  return state;
}

function correct(state: CorrectionState): void {
  const file = path.join(state.root, target);
  writeFileSync(
    file,
    `${readFileSync(file, 'utf8')}\n## Required correction\n\nReject missing authentication before advancing under accepted Rule approval.BU1.R1.\n`,
  );
}

Given(
  'a review blocked on a uniquely determined correction under an accepted decision',
  { timeout: 120_000 },
  function (this: SafewordWorld) {
    rejectedPlan(this);
  },
);

When(
  'the correction changes the plan bytes without a fresh review',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    correct(state);
    state.gate = command(state, ['ticket', 'approve-plan', 'CTX123', '--cwd', state.root]);
  },
);

Then(
  'the corrected plan remains blocked until a verdict is recorded against those exact bytes',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.gate);
    assert.equal(state.gate.status, 2, state.gate.stdout);
    assert.match(
      readFileSync(path.join(state.root, ticket, 'ticket.md'), 'utf8'),
      /phase: plan-implementation/u,
    );
    assert.ok(state.initialReviewId);
    const status = command(state, ['review', 'status', state.initialReviewId]);
    const output = JSON.parse(status.stdout);
    assert.equal(output.data.status, 'stale');
  },
);

Given(
  'corrected plan bytes have a fresh approving verdict recorded against those exact bytes',
  { timeout: 180_000 },
  function (this: SafewordWorld) {
    const state = rejectedPlan(this);
    correct(state);
    reviewerExecutable(state.reviewer);
    state.freshReviewId = review(state, 'approved');
    assert.notEqual(state.freshReviewId, state.initialReviewId);
    const recorded = spawnSync(
      'bun',
      [
        path.join(pluginRoot, 'runtime/hooks/write-review-stamp.ts'),
        '--ticket',
        'CTX123-current-context',
        '--author-agent',
        'claude',
        '--reviewer-agent',
        'opencode',
        '--independence',
        'reduced',
        '--review-id',
        state.freshReviewId,
        '--phase',
        'plan-implementation',
      ],
      { cwd: state.root, env: state.environment, encoding: 'utf8', timeout: 60_000 },
    );
    assert.equal(recorded.status, 0, `${recorded.stdout}\n${recorded.stderr}`);
  },
);

When('the phase gate reevaluates the prior correction block', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state);
  state.gate = command(state, ['ticket', 'approve-plan', 'CTX123', '--cwd', state.root]);
});

Then(
  'the prior block is cleared and that correction no longer prevents the phase transition',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.gate);
    assert.equal(state.gate.status, 0, `${state.gate.stdout}\n${state.gate.stderr}`);
    assert.equal(
      readFileSync(path.join(state.root, ticket, 'execution-plan.md'), 'utf8'),
      readFileSync(
        path.join(getTemplatesDirectory(), 'doc-templates/execution-plan-template.md'),
        'utf8',
      ),
    );
    assert.match(
      readFileSync(path.join(state.root, ticket, 'ticket.md'), 'utf8'),
      /phase: plan-execution/u,
    );
  },
);

After(function (this: SafewordWorld) {
  const state = states.get(this);
  if (!state) return;
  rmSync(state.root, { recursive: true, force: true });
  rmSync(state.reviewer, { recursive: true, force: true });
  states.delete(this);
});
