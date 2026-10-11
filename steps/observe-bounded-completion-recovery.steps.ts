import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Then, When } from '@cucumber/cucumber';

import { validLedgerRecoveryObservationTag } from '../packages/cli/src/review/job.js';
import cases from '../packages/cli/src/review/ledger-recovery-cases.json' with { type: 'json' };
import { assessRecoveryReport } from '../packages/cli/src/review/ledger-recovery-report.js';
import { SafewordWorld } from './world.js';

const root = nodePath.resolve(import.meta.dirname, '..');
const cli = nodePath.join(root, 'packages/cli/dist/cli.js');

When(
  'I observe the current committed 5F5ZZA candidate through the public CLI',
  { timeout: 7_200_000 },
  function (this: SafewordWorld) {
    const result = spawnSync(
      process.execPath,
      [
        cli,
        '--json',
        '--no-input',
        '--cwd',
        root,
        'review',
        'observe',
        'ledger-recovery',
        '--ticket',
        '5F5ZZA',
      ],
      {
        cwd: root,
        env: { ...process.env, NODE_OPTIONS: undefined },
        encoding: 'utf8',
        timeout: 7_100_000,
        maxBuffer: 8_000_000,
      },
    );
    this.result = {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.status ?? 1,
    };
  },
);

Then(
  'the retained recovery observation contains all 142 passing active cases',
  function (this: SafewordWorld) {
    const envelope = JSON.parse(this.result.stdout);
    assert.equal(envelope.data.status, 'observed', this.result.stdout + this.result.stderr);
    assert.equal(this.result.exitCode, 0);
    const observation = JSON.parse(readFileSync(envelope.data.observation, 'utf8'));
    assert.equal(observation.kind, 'ledger-recovery-observation:v1');
    assert.equal(observation.ticket, '5F5ZZA');
    assert.equal(observation.summary.passed, 142);
    assert.equal(observation.summary.deferred, 33);
    assert.equal(observation.summary.cases.length, 142);
    assert.deepEqual(
      observation.summary.cases,
      cases.filter(item => !item.deferred).map(item => item.digest),
    );
    assert.equal(observation.exitCode, 0);
    assert.match(observation.productTree, /^[a-f0-9]{64}$/);
    assert.match(observation.reportSha256, /^[a-f0-9]{64}$/);
    const report = readFileSync(observation.report);
    assert.equal(createHash('sha256').update(report).digest('hex'), observation.reportSha256);
    assert.deepEqual(
      assessRecoveryReport(JSON.parse(report.toString()), observation.exitCode),
      observation.summary,
    );
    const content = readFileSync(envelope.data.observation, 'utf8');
    assert.equal(
      validLedgerRecoveryObservationTag(root, content, readFileSync(envelope.data.tag, 'utf8')),
      true,
    );
    const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
    assert.equal(observation.revision, head.stdout.trim());
    assert.ok(observation.inputs.some((input: { path: string }) => input.path === 'cucumber.mjs'));
  },
);

Then('observation alone cannot close 5F5ZZA without independent certification', function () {
  const result = spawnSync(
    process.execPath,
    [
      cli,
      '--json',
      '--no-input',
      '--cwd',
      root,
      'review',
      'gate',
      'ledger-recovery',
      '--ticket',
      '5F5ZZA',
    ],
    { cwd: root, encoding: 'utf8', timeout: 30_000 },
  );
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.notEqual(JSON.parse(result.stdout).data.status, 'approved');
});
