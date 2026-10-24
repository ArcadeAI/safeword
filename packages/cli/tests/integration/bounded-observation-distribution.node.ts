/* eslint-disable vitest/no-import-node-test -- Real CLI checks stay outside every Vitest parent. */

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { test } from 'node:test';

import { observerRepo } from '../fixtures/bounded-observation.js';

for (const entry of [
  'packages/cli/src/cli.ts',
  'plugin/runtime/cli.js',
  'packages/cli/codex-plugin/runtime/cli.js',
]) {
  void test(`${entry}: failed candidate startup cleans its owned work directory`, () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'bounded-startup-'));
    const repo = nodePath.join(directory, 'repository');
    const scratch = nodePath.join(directory, 'tmp');
    mkdirSync(repo);
    mkdirSync(scratch);
    try {
      execFileSync('git', ['init', '--quiet', '--template='], { cwd: repo });
      const child = spawnSync(
        'bun',
        [
          '--no-env-file',
          nodePath.join(observerRepo, entry),
          'proof',
          'observe-bounded-delivery',
          '--json',
          '--no-input',
          '--offline',
        ],
        {
          cwd: repo,
          encoding: 'utf8',
          timeout: 10_000,
          env: {
            PATH: process.env.PATH,
            HOME: directory,
            XDG_STATE_HOME: nodePath.join(directory, 'state'),
            TMPDIR: scratch,
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );
      assert.equal(child.error, undefined);
      assert.equal(child.status, 2, child.stdout + child.stderr);
      const output = JSON.parse(child.stdout) as { data: { authority: string; current: boolean } };
      assert.equal(output.data.authority, 'execution-only');
      assert.equal(output.data.current, false);
      const leaked = readdirSync(scratch).filter(name => name.startsWith('safeword-bounded-'));
      assert.deepEqual(leaked, [], 'Failed prerequisite must clean its owned work directory');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  void test(`${entry}: missing evidence refuses without creating observer state`, () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'bounded-reader-'));
    const state = nodePath.join(directory, 'state');
    try {
      const child = spawnSync(
        'bun',
        [
          '--no-env-file',
          nodePath.join(observerRepo, entry),
          'proof',
          'verify-bounded-delivery',
          '11111111-1111-4111-8111-111111111111',
          '--json',
          '--no-input',
          '--offline',
        ],
        {
          cwd: observerRepo,
          encoding: 'utf8',
          timeout: 10_000,
          env: {
            PATH: process.env.PATH,
            HOME: directory,
            XDG_STATE_HOME: state,
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );
      assert.equal(child.error, undefined);
      assert.equal(child.status, 2, child.stdout + child.stderr);
      assert.equal(child.stderr, '');
      const output = JSON.parse(child.stdout) as {
        data: { authority: string; purpose: string; current: boolean };
      };
      assert.equal(output.data.authority, 'execution-only');
      assert.equal(output.data.purpose, 'bounded-delivery-observation:v1');
      assert.equal(output.data.current, false);
      assert.equal(
        existsSync(state),
        false,
        'Read-only verification cannot allocate state or a key',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  void test(`${entry}: wrong repository refusal is complete JSON without stderr`, () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'bounded-distribution-'));
    try {
      const child = spawnSync(
        'bun',
        [
          '--no-env-file',
          nodePath.join(observerRepo, entry),
          'proof',
          'observe-bounded-delivery',
          '--json',
          '--no-input',
          '--offline',
        ],
        {
          cwd: directory,
          encoding: 'utf8',
          timeout: 10_000,
          env: { PATH: process.env.PATH, HOME: directory, SAFEWORD_NO_UPDATE_CHECK: '1' },
        },
      );
      assert.equal(child.error, undefined);
      assert.equal(child.status, 2, child.stdout + child.stderr);
      assert.equal(
        child.stderr,
        '',
        'Machine refusals must keep diagnostics inside the JSON envelope',
      );
      const output = JSON.parse(child.stdout) as {
        data: { authority: string; purpose: string; current: boolean };
        errors: { code: string; message: string }[];
      };
      assert.equal(output.data.authority, 'execution-only');
      assert.equal(output.data.purpose, 'bounded-delivery-observation:v1');
      assert.equal(output.data.current, false);
      assert.ok(output.errors.some(error => error.code === 'BOUNDED_OBSERVATION_REFUSED'));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
