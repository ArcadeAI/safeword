import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { After, Given, Status, Then, When } from '@cucumber/cucumber';

import { prepareReviewPacket } from '../packages/cli/src/review/packet.js';
import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';
import { resolveConfiguredPath } from '../packages/cli/src/utils/configured-paths.js';
import { target } from '../packages/cli/tests/fixtures/planning-disposition.js';
import { runCliWithLiteralArguments } from '../packages/cli/tests/helpers.js';
import { createTrustedReviewerDirectory } from '../packages/cli/tests/review-fixtures.js';
import {
  prepareRecordedSuggestion,
  recordedSuggestion,
} from './keep-plan-reviews-disposition.steps.js';
import {
  dispatchInstalledPhaseExit,
  nativeReviewEnvironment,
  runJudgedNativeReview,
  type NativeScopeState,
} from './keep-plan-reviews-native-scope.steps.js';
import { completeNativeScopeProject } from './support/planning-scope-project.js';
import type { SafewordWorld } from './world.js';

interface NativeDispositionState extends NativeScopeState {
  captureDirectory: string;
  reviewerSearchPath: string;
  ticketBeforeReview: string;
}
const states = new WeakMap<SafewordWorld, NativeDispositionState>();

function sentReviewPackets(state: NativeDispositionState) {
  const packets = readdirSync(state.captureDirectory)
    .map(file => readFileSync(path.join(state.captureDirectory, file), 'utf8').trim())
    .flatMap(input =>
      input
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line)),
    )
    .filter(message => message.method === 'turn/start')
    .flatMap(message => message.params.input)
    .filter(input => input.type === 'text')
    .map(input => JSON.parse(input.text.trim().split('\n').at(-1)!));
  assert.equal(packets.length, 3, 'Capture all three actual reviewer requests.');
  return packets;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function dispositionDispatch(root: string): string {
  return dispatchInstalledPhaseExit(
    root,
    `${path.dirname(target)}/ticket.md`,
    'plan-implementation',
    'plan-execution',
  );
}

async function prepareNativeDisposition(this: SafewordWorld, decision: 'declined' | 'pending') {
  // The existing trusted reviewer process supplies only this initial warning.
  // The later review under test uses the real qualified independent producer.
  await prepareRecordedSuggestion(this);
  const disposition = recordedSuggestion(this);
  const { project } = disposition;
  const installed = await runCliWithLiteralArguments(
    ['install', '--agents', 'cursor', '--offline', '--no-input', '--json', '--cwd', project.root],
    { cwd: project.root, env: nativeReviewEnvironment(project.root) },
  );
  assert.equal(installed.exitCode, 0, installed.stdout + installed.stderr);
  mkdirSync(path.join(project.root, '.claude'), { recursive: true });
  writeFileSync(
    path.join(project.root, '.claude/settings.json'),
    JSON.stringify(SAFEWORD_SCHEMA.jsonMerges['.claude/settings.json'].merge({})),
  );
  const configPath = path.join(project.root, '.safeword/config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.crossAgentReviewRoutes = { claude: [{ reviewer: 'codex', model: 'gpt-6.1-sol' }] };
  writeFileSync(configPath, JSON.stringify(config));
  const nativeProject = {
    root: project.root,
    planPath: target.replace('spec.md', 'impl-plan.md'),
    input: { context: '', reviewed_plan: '' },
  };
  nativeProject.input = {
    context: JSON.stringify(
      prepareReviewPacket(project.root, 'plan-implementation', [nativeProject.planPath]).packet,
    ),
    reviewed_plan: readFileSync(path.join(project.root, nativeProject.planPath), 'utf8'),
  };
  // Completion reads this captured input to check that it preserves scope.
  completeNativeScopeProject(nativeProject);
  const planFile = path.join(project.root, nativeProject.planPath);
  const plan = `${readFileSync(planFile, 'utf8')}

## Accepted receipt and recovery decisions

After the guarded write succeeds, the endpoint and CLI receipt identify the authenticated consenting owner using the existing trusted session owner label, never a caller-supplied label or a consent credential. The CLI-to-endpoint proof checks that the success receipt names that owner and discloses no token. Refusal, pre-commit failure and an uncertain post-commit result must not present a confirmed-success receipt.

The recovery proof drives the real CLI through a pre-commit transient endpoint failure, establishes unchanged account state, then retries the same target change with valid owner consent and establishes one successful mutation. This sequence must fail if the failed attempt consumes consent or prevents recovery. It is separate from the post-commit uncertain-result proof, which permits no automatic retry or false no-mutation claim.
`;
  writeFileSync(planFile, plan);
  // This is an explicit synthetic fixture premise, not a vendor claim.
  const resolvedArchitecture = resolveConfiguredPath(project.root, 'architecture');
  writeFileSync(
    resolvedArchitecture,
    `${readFileSync(resolvedArchitecture, 'utf8')}
The existing authenticated session includes the consenting owner's display label; account-change presentation uses that trusted label and never accepts a caller-supplied replacement.
`,
  );
  // The authenticated warning and explicit decline refer to the completed
  // baseline. No fixture completion or plan correction follows the decline.
  const seeded = await project.run([
    'review',
    'run',
    'plan-implementation',
    nativeProject.planPath,
  ]);
  assert.equal(seeded.exitCode, 0, seeded.stdout + seeded.stderr);
  const seed = JSON.parse(seeded.stdout).data;
  assert.equal(seed.status, 'approved');
  assert.deepEqual(seed.reviewer_output.findings, [
    { severity: 'warning', message: 'Consider adding optional multi-region failover.' },
  ]);
  const reviewId = seed.review_id;
  disposition.plan = plan;
  disposition.reviewId = reviewId;
  if (decision === 'declined') {
    const declined = project.terminal('y', reviewId);
    assert.equal(declined.status, 0, declined.stdout + declined.stderr);
    assert.match(declined.stdout, /"status":"recorded"/u);
  }
  assert.equal(readFileSync(planFile, 'utf8'), disposition.plan);
  const packet = prepareReviewPacket(project.root, 'plan-implementation', [
    nativeProject.planPath,
  ]).packet;
  const record = packet.review_disposition_context?.records[0];
  if (decision === 'declined') {
    assert.ok(record);
    assert.equal(record.review_id, reviewId);
    assert.equal(record.disposition, 'declined');
    assert.equal(record.boundary_status, 'current');
    assert.equal(record.message, 'Consider adding optional multi-region failover.');
  } else {
    assert.equal(record, undefined, 'An outstanding choice must not become a decline.');
  }
  nativeProject.input = {
    context: JSON.stringify(packet),
    reviewed_plan: readFileSync(path.join(project.root, nativeProject.planPath), 'utf8'),
  };
  assert.match(dispositionDispatch(project.root), /safeword review run plan-implementation/u);
  const located = spawnSync('/bin/sh', ['-c', 'command -v codex'], { encoding: 'utf8' });
  assert.equal(located.status, 0, located.stderr);
  const binary = located.stdout.trim();
  assert.ok(path.isAbsolute(binary), 'A real caller-selected Codex executable is required.');
  const observer = createTrustedReviewerDirectory('safeword-r14-real-codex-');
  const captureDirectory = path.join(project.root, '.safeword/state/r14-review-inputs');
  mkdirSync(captureDirectory, { recursive: true });
  // A local wire observer, not a reviewer mock: stdin is copied byte-for-byte
  // to the actual caller-selected executable, with its stdout/exit unchanged.
  writeFileSync(
    path.join(observer, 'codex'),
    `#!/bin/sh
if [ "$1" = "app-server" ]; then
  /usr/bin/tee ${shellQuote(path.join(captureDirectory, 'input-'))}"$$".txt | ${shellQuote(binary)} "$@"
else
  exec ${shellQuote(binary)} "$@"
fi
`,
    { mode: 0o755 },
  );
  states.set(this, {
    roots: [observer],
    project: nativeProject,
    caseId: decision === 'declined' ? 'r14-declined-strengthening' : 'r14-pending-strengthening',
    runs: [],
    captureDirectory,
    reviewerSearchPath: `${observer}:${process.env.PATH ?? ''}`,
    ticketBeforeReview: readFileSync(project.ticketPath, 'utf8'),
  });
}

Given(
  'the user recorded a decline for an optional strengthening under the current accepted boundary and left the plan unchanged',
  { timeout: 60_000 },
  async function (this: SafewordWorld) {
    await prepareNativeDisposition.call(this, 'declined');
  },
);

Given(
  'a nonblocking suggestion outside the accepted boundary awaits a user decision',
  { timeout: 60_000 },
  async function (this: SafewordWorld) {
    await prepareNativeDisposition.call(this, 'pending');
  },
);

When(
  'the unchanged plan is re-reviewed while that decision remains outstanding',
  { timeout: 240_000 },
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    await runJudgedNativeReview(state, {
      kind: 'plan-implementation',
      phase: 'plan-implementation',
      dispatch: dispositionDispatch,
      reviewerSearchPath: state.reviewerSearchPath,
    });
  },
);

Then(
  'the reviewed plan bytes remain unchanged, the gate does not block on or silently add the suggestion, and the outstanding choice is re-presented for the user to decide',
  { timeout: 60_000 },
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    assert.ok(
      state.runs.filter(
        run =>
          run.correct &&
          run.output.verdict === 'approve' &&
          run.output.findings.every(
            finding =>
              !/failover/iu.test(finding.message) || ['warning', 'info'].includes(finding.severity),
          ) &&
          run.stampStatus === 0 &&
          !/deny/u.test(run.gate),
      ).length >= 2,
      JSON.stringify(state.runs),
    );
    const disposition = recordedSuggestion(this);
    const presented = await disposition.project.run([
      'ticket',
      'record-review-disposition',
      'DIS123',
      disposition.reviewId,
      '1',
      '--reason',
      'Outside the accepted scope.',
    ]);
    const result = JSON.parse(presented.stdout);
    assert.equal(result.state, 'action_required');
    assert.equal(result.data.status, 'pending');
    assert.equal(result.data.review_id, disposition.reviewId);
    assert.equal(result.data.finding, 'Consider adding optional multi-region failover.');
    assert.equal(readFileSync(disposition.project.ticketPath, 'utf8'), state.ticketBeforeReview);
    assert.equal(
      readFileSync(path.join(state.project.root, state.project.planPath), 'utf8'),
      disposition.plan,
    );
    const packet = prepareReviewPacket(state.project.root, 'plan-implementation', [
      state.project.planPath,
    ]).packet;
    assert.equal(packet.review_disposition_context?.records.length ?? 0, 0);
    for (const dispatched of sentReviewPackets(state))
      assert.equal(
        dispatched.review_disposition_context?.records.length ?? 0,
        0,
        'The actual reviewer must not receive an invented decline.',
      );
  },
);

When(
  'a later judged re-review runs through installed local project hooks with real configuration and collaborators, mocking only non-reviewer process boundaries',
  { timeout: 240_000 },
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    await runJudgedNativeReview(state, {
      kind: 'plan-implementation',
      phase: 'plan-implementation',
      dispatch: dispositionDispatch,
      reviewerSearchPath: state.reviewerSearchPath,
    });
  },
);

Then(
  'the decline is supplied to the reviewer, the suggestion remains nonblocking, and any approval is recorded against the unchanged plan bytes',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    assert.ok(
      state.runs.filter(
        run =>
          run.correct &&
          run.output.verdict === 'approve' &&
          run.output.findings.every(
            finding =>
              !/failover/iu.test(finding.message) || ['warning', 'info'].includes(finding.severity),
          ) &&
          run.stampStatus === 0 &&
          !/deny/u.test(run.gate),
      ).length >= 2,
      JSON.stringify(state.runs),
    );
    for (const packet of sentReviewPackets(state)) {
      assert.ok(
        packet.review_disposition_context.records.some(
          (record: {
            review_id: string;
            disposition: string;
            boundary_status: string;
            message: string;
          }) =>
            record.review_id === recordedSuggestion(this).reviewId &&
            record.disposition === 'declined' &&
            record.boundary_status === 'current' &&
            record.message === 'Consider adding optional multi-region failover.',
        ),
        'The real dispatched packet must contain the current decline.',
      );
    }
    const packet = prepareReviewPacket(state.project.root, 'plan-implementation', [
      state.project.planPath,
    ]).packet;
    assert.equal(packet.review_disposition_context?.records[0]?.disposition, 'declined');
    assert.equal(packet.review_disposition_context?.records[0]?.boundary_status, 'current');
    assert.equal(
      readFileSync(path.join(state.project.root, state.project.planPath), 'utf8'),
      state.project.input.reviewed_plan,
    );
    assert.equal(
      readFileSync(path.join(state.project.root, state.project.planPath), 'utf8'),
      recordedSuggestion(this).plan,
    );
  },
);

After(function (this: SafewordWorld, scenario) {
  if (scenario.result?.status === Status.FAILED) {
    console.error(
      `Retained reviewer inputs: ${states.get(this)?.captureDirectory ?? 'setup failed'}`,
    );
  }
  for (const observer of states.get(this)?.roots ?? [])
    rmSync(observer, { recursive: true, force: true });
  states.delete(this);
});
