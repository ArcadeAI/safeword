import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Given, Then } from '@cucumber/cucumber';

import { installedReviewCli } from '../packages/cli/tests/fixtures/execution-review.js';
import { reviewerScript } from '../packages/cli/tests/fixtures/planning-reviewers.js';
import { coordinate, prepare } from './keep-plan-reviews-independence.steps.js';
import type { SafewordWorld } from './world.js';

const folder = '.project/tickets/CTX123-current-context';
type DenialState = Awaited<ReturnType<typeof prepare>> & {
  ledger: string;
  beforeWriter: string;
  validLedger: string;
  fallbackMarker: string;
};
const states = new WeakMap<SafewordWorld, DenialState>();

function stamp(state: DenialState) {
  assert.ok(state.result);
  return spawnSync(
    'bun',
    [
      path.join(state.root, '.safeword/hooks/write-review-stamp.ts'),
      '--ticket',
      path.basename(folder),
      '--phase',
      'plan-implementation',
      '--review-id',
      state.result.data.review_id,
      '--author-agent',
      'claude',
      '--reviewer-agent',
      'codex',
      '--independence',
      'cross-agent',
    ],
    { cwd: state.root, env: { ...process.env, ...state.env }, encoding: 'utf8', timeout: 60_000 },
  );
}

Given(
  'the review coordinator has returned a typed no-independent-route-attempted result',
  { timeout: 120_000 },
  async function (this: SafewordWorld) {
    const base = await prepare(this, true);
    const state = Object.assign(base, {
      ledger: path.join(base.root, '.project/skill-invocations.log'),
      beforeWriter: '',
      validLedger: '',
      fallbackMarker: `${base.marker}-headless`,
    });
    states.set(this, state);
    await coordinate(state);
    const initialId = state.result?.data.review_id;
    assert.ok(initialId);
    const written = stamp(state);
    assert.equal(written.status, 0, written.stdout + written.stderr);
    const cli = installedReviewCli(state.root);
    const allowed = await cli(
      ['ticket', 'approve-plan', 'CTX123', '--json', '--no-input', '--cwd', state.root],
      { cwd: state.root, env: state.env },
    );
    assert.equal(allowed.exitCode, 0, allowed.stdout);
    const ticket = path.join(state.root, folder, 'ticket.md');
    const advanced = readFileSync(ticket, 'utf8');
    assert.match(advanced, /phase: plan-execution/u);
    writeFileSync(ticket, advanced.replace('phase: plan-execution', 'phase: plan-implementation'));
    state.evaluateGate = async () => {
      const manifest = JSON.parse(
        readFileSync(path.join(state.root, '.cursor/hooks.json'), 'utf8'),
      );
      const command = manifest.hooks.preToolUse.find(
        (hook: { matcher: string }) => hook.matcher === 'Write',
      ).command;
      const result = spawnSync('/bin/sh', ['-c', command], {
        cwd: state.root,
        env: { ...process.env, ...state.env },
        encoding: 'utf8',
        timeout: 60_000,
        input: JSON.stringify({
          conversation_id: 'r6-route-denial',
          workspace_roots: [state.root],
          cwd: state.root,
          tool_name: 'Write',
          tool_input: {
            file_path: ticket,
            content: readFileSync(ticket, 'utf8').replace(
              'phase: plan-implementation',
              'phase: plan-execution',
            ),
          },
        }),
      });
      assert.equal(result.error, undefined, result.error?.message);
      assert.equal(result.status, 0, result.stderr);
      return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
    };
    const nativeAllowed = await state.evaluateGate();
    assert.equal(JSON.parse(nativeAllowed.stdout).permission, 'allow', nativeAllowed.stdout);
    {
      const configPath = path.join(state.root, '.safeword/config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      writeFileSync(
        configPath,
        JSON.stringify({
          ...config,
          crossAgentReviewRoutes: {
            claude: [{ reviewer: 'claude' }],
          },
        }),
      );
      writeFileSync(
        path.join(path.dirname(state.marker), 'claude'),
        reviewerScript(
          'claude',
          state.fallbackMarker,
          `${state.fallbackMarker}.packet`,
          false,
          false,
        ),
        { mode: 0o755 },
      );
    }
    const result = await cli(
      [
        'review',
        'run',
        'plan-implementation',
        `${folder}/impl-plan.md`,
        '--context',
        'features/current-context.feature',
        '--context',
        `${folder}/spec.md`,
        '--json',
        '--no-input',
        '--cwd',
        state.root,
      ],
      { cwd: state.root, env: state.env },
    );
    state.result = JSON.parse(result.stdout);
    assert.ok(state.result);
    assert.equal(state.result.data.status, 'blocked', result.stdout);
    assert.notEqual(state.result.data.review_id, initialId);
    assert.equal(result.exitCode, 2, result.stdout);
    const initialLedger = readFileSync(state.ledger, 'utf8');
    state.validLedger = initialLedger;
    assert.ok(initialLedger.includes(`review-id:${initialId}`));
    // A plaintext locator is deliberately forged; the real receipt must still govern admission.
    state.beforeWriter = initialLedger.replaceAll(initialId, state.result.data.review_id);
    writeFileSync(state.ledger, state.beforeWriter);
  },
);

Then(
  'the phase remains blocked with reviewer-route reconciliation named',
  { timeout: 120_000 },
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.result && state.gate);
    assert.equal(state.gate.exitCode, 0, state.gate.stdout);
    assert.equal(JSON.parse(state.gate.stdout).permission, 'deny');
    assert.ok(state.gate.stdout.includes(state.result.data.review_id), state.gate.stdout);
    assert.match(
      readFileSync(path.join(state.root, folder, 'ticket.md'), 'utf8'),
      /phase: plan-implementation/u,
    );
    const refused = stamp(state);
    assert.equal(refused.status, 1, refused.stdout + refused.stderr);
    assert.equal(readFileSync(state.ledger, 'utf8'), state.beforeWriter);
    writeFileSync(state.ledger, `${state.beforeWriter}\n${state.validLedger}`);
    assert.ok(state.evaluateGate);
    const validAfterInvalid = await state.evaluateGate();
    assert.equal(
      JSON.parse(validAfterInvalid.stdout).permission,
      'allow',
      validAfterInvalid.stdout,
    );
    writeFileSync(state.ledger, state.beforeWriter);
    const current = await installedReviewCli(state.root)(
      ['review', 'status', state.result.data.review_id, '--json', '--cwd', state.root],
      { cwd: state.root, env: state.env },
    );
    const receipt = JSON.parse(current.stdout).data;
    assert.equal(receipt.review_id, state.result.data.review_id);
    assert.equal(receipt.status, 'blocked', current.stdout);
    {
      assert.equal(receipt.independence, 'none');
      assert.deepEqual(receipt.review_routes, [
        { reviewer: 'claude', independence: 'degraded', status: 'unattempted' },
      ]);
      assert.ok(!existsSync(state.fallbackMarker), 'An unearned fallback must never launch');
      assert.match(
        JSON.parse(state.gate.stdout).user_message,
        /Reviewer-route reconciliation is required before leaving "plan-implementation"/u,
      );
      assert.match(state.gate.stdout, /did not approve.*blocked/iu);
      assert.match(refused.stdout, /did not approve.*blocked/iu);
    }
  },
);
