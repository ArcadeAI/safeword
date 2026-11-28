import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { Given, Then, When } from '@cucumber/cucumber';

import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';
import type { SafewordWorld } from './world.js';

const asset = '.cursor/commands/verify.md';
const test = 'should NOT have any path in BOTH deprecatedFiles AND ownedFiles';
const cli = path.resolve(import.meta.dirname, '../packages/cli');

interface CollisionWorld extends SafewordWorld {
  collisionFailure?: string[];
  template?: { path: string; bytes: Buffer };
}

Given(
  'a cleanup inventory entry also identifies a currently shipped framework asset',
  function (this: CollisionWorld) {
    const template = SAFEWORD_SCHEMA.ownedFiles[asset]?.template;
    assert.ok(template);
    const file = path.join(cli, 'templates', template);
    this.template = { path: file, bytes: readFileSync(file) };
    assert.ok(!SAFEWORD_SCHEMA.deprecatedFiles.includes(asset));
  },
);

When(
  'the required migration checks evaluate that inventory',
  { timeout: 120_000 },
  function (this: CollisionWorld) {
    const dir = mkdtempSync(path.join(tmpdir(), 'safeword-inventory-gate-'));
    const reportPath = path.join(dir, 'result.json');
    try {
      const { status, stdout, stderr } = spawnSync(
        path.join(cli, 'node_modules/.bin/vitest'),
        [
          'run',
          'tests/schema.test.ts',
          '--testNamePattern',
          test,
          '--config',
          'tests/fixtures/host-contract/vitest.cleanup-collision.mjs',
          '--reporter',
          'json',
          '--outputFile',
          reportPath,
        ],
        {
          cwd: cli,
          encoding: 'utf8',
          timeout: 90_000,
          env: { ...process.env, SAFEWORD_COLLISION_ASSET: asset },
        },
      );
      assert.equal(status, 1, stderr || stdout);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      assert.equal(report.numFailedTests, 1);
      const results = report.testResults.flatMap(
        (suite: {
          assertionResults: { title: string; status: string; failureMessages: string[] }[];
        }) => suite.assertionResults,
      );
      const failed = results.filter((row: { status: string }) => row.status === 'failed');
      assert.equal(failed.length, 1);
      assert.ok(failed[0].title.startsWith(test));
      this.collisionFailure = failed[0].failureMessages;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

Then(
  'the checks reject the collision before current delivery is removed',
  function (this: CollisionWorld) {
    assert.ok(this.collisionFailure?.some(message => message.includes(asset)));
    assert.ok(this.template);
    assert.deepEqual(readFileSync(this.template.path), this.template.bytes);
  },
);
