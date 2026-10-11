import { strict as assert } from 'node:assert';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Given, Then } from '@cucumber/cucumber';

import { installedReviewCli } from '../packages/cli/tests/fixtures/execution-review.js';
import { reviewerScript } from '../packages/cli/tests/fixtures/planning-reviewers.js';
import { coordinate, prepare } from './keep-plan-reviews-independence.steps.js';
import type { SafewordWorld } from './world.js';

type OriginState = Awaited<ReturnType<typeof prepare>> & {
  refusal: { errors: { code: string; message: string }[] };
  ticketBefore: string;
};
const states = new WeakMap<SafewordWorld, OriginState>();
const ticket = '.project/tickets/CTX123-current-context/ticket.md';

Given(
  'the review coordinator has returned an approval submitted from an ungated surface',
  { timeout: 120_000 },
  async function (this: SafewordWorld) {
    const state = await prepare(this, true);
    writeFileSync(
      path.join(path.dirname(state.marker), 'codex'),
      reviewerScript('codex', state.marker, `${state.marker}.packet`, true, true),
      { mode: 0o755 },
    );
    await coordinate(state, 'codex', 'continuation_required');
    assert.ok(state.result?.data.continuation);
    const continuation = state.result.data.continuation;
    assert.equal(continuation.tier, 'fresh-context');
    writeFileSync(
      path.join(state.root, 'ungated-approval.json'),
      JSON.stringify({
        schema_version: 1,
        dispatch_id: continuation.packet.dispatch_id,
        reviewer_agent: 'claude',
        verdict: 'approve',
        summary: 'Approve the current bounded plan.',
        findings: [],
        evidence_records: { schema_version: 1, records: [] },
      }),
    );
    const before = readFileSync(path.join(state.root, ticket), 'utf8');
    const rejected = await installedReviewCli(state.root)(
      [
        'review',
        'continue',
        state.result.data.review_id,
        '--tier',
        'fresh-context',
        '--output',
        'ungated-approval.json',
        '--json',
        '--cwd',
        state.root,
      ],
      {
        cwd: state.root,
        // No supported local origin. Only this child's host identity is absent;
        // the sealed job and supplied output are genuine public-flow fixtures.
        env: {
          ...state.env,
          SAFEWORD_AGENT_RUNTIME: 'unknown',
          CLAUDE_SESSION_ID: '',
          CLAUDE_CODE_SESSION_ID: '',
          CODEX_THREAD_ID: '',
        },
      },
    );
    assert.equal(rejected.exitCode, 1, rejected.stdout);
    const refusal = JSON.parse(rejected.stdout);
    assert.deepEqual(
      refusal.errors.map((error: { code: string }) => error.code),
      ['REVIEW_CONTINUATION_ORIGIN_UNVERIFIED'],
    );
    states.set(this, Object.assign(state, { refusal, ticketBefore: before }));
  },
);

Then(
  'the phase remains blocked and the unsupported approval origin is named',
  { timeout: 60_000 },
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.result && state.gate);
    assert.equal(state.gate.exitCode, 2, state.gate.stdout);
    assert.match(state.refusal.errors[0]!.message, /supported local agent origin/u);
    assert.equal(readFileSync(path.join(state.root, ticket), 'utf8'), state.ticketBefore);
    const cli = installedReviewCli(state.root);
    const current = await cli(
      ['review', 'status', state.result.data.review_id, '--json', '--cwd', state.root],
      { cwd: state.root, env: state.env },
    );
    assert.equal(JSON.parse(current.stdout).data.status, 'continuation_required');
    // Positive control: the same output and sealed job are valid from the
    // supported author origin. Refusing all continuations cannot pass this test.
    const accepted = await cli(
      [
        'review',
        'continue',
        state.result.data.review_id,
        '--tier',
        'fresh-context',
        '--output',
        'ungated-approval.json',
        '--json',
        '--cwd',
        state.root,
      ],
      { cwd: state.root, env: state.env },
    );
    assert.equal(accepted.exitCode, 0, accepted.stdout);
    assert.equal(JSON.parse(accepted.stdout).data.status, 'approved');
    assert.equal(readFileSync(path.join(state.root, ticket), 'utf8'), state.ticketBefore);
    states.delete(this);
  },
);
