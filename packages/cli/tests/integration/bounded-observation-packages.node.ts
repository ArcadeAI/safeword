/* eslint-disable vitest/no-import-node-test -- Packaged CLI proofs must not nest Vitest. */

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import nodePath from 'node:path';
import { test } from 'node:test';

import {
  createObserverCandidate,
  expectCompleteObservation,
  type ObserverCandidate,
  type ObserverCommand,
  type ObserverOutput,
  observerRepo,
} from '../fixtures/bounded-observation.js';
import { attemptBytes } from '../fixtures/bounded-observation-lifecycle.js';

function request(
  candidate: ObserverCandidate,
  entry: string,
  executor: string,
  operands: string[],
): ObserverCommand {
  const child = spawnSync(
    executor,
    [entry, 'proof', ...operands, '--json', '--no-input', '--offline'],
    {
      cwd: candidate.root,
      env: candidate.environment,
      encoding: 'utf8',
      timeout: 900_000,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  assert.equal(child.error, undefined);
  return {
    exitCode: child.status,
    stdout: child.stdout,
    stderr: child.stderr,
    output: JSON.parse(child.stdout) as ObserverOutput,
  };
}

function verifyCurrent(
  candidate: ObserverCandidate,
  entry: string,
  executor: string,
  id: string,
): void {
  const verified = request(candidate, entry, executor, ['verify-bounded-delivery', id]);
  assert.equal(verified.exitCode, 0, verified.stdout + verified.stderr);
  assert.equal(verified.output.data?.current, true);
}

for (const relative of ['plugin/runtime/cli.js', 'packages/cli/codex-plugin/runtime/cli.js']) {
  void test(
    `${relative}: complete shipped proof verifies through the same reader`,
    { timeout: 900_000 },
    () => {
      const candidate = createObserverCandidate();
      const host = createObserverCandidate();
      try {
        const entry = nodePath.join(host.root, relative);
        const result = request(candidate, entry, 'bun', ['observe-bounded-delivery']);
        expectCompleteObservation(result, candidate);
        const id = result.output.data?.attempt_id;
        assert.ok(id);
        verifyCurrent(candidate, entry, 'bun', id);
        const packageManifest = nodePath.resolve(nodePath.dirname(entry), '../package.json');
        const original = readFileSync(packageManifest);
        const metadata = JSON.parse(original.toString('utf8')) as Record<string, unknown>;
        metadata.observer_currency_control = true;
        writeFileSync(packageManifest, JSON.stringify(metadata));
        const stale = request(candidate, entry, 'bun', ['verify-bounded-delivery', id]);
        assert.equal(
          stale.exitCode,
          2,
          'Changed external native package metadata must stale retained proof',
        );
        assert.equal(stale.output.data?.current, false);
        writeFileSync(packageManifest, original);
        verifyCurrent(candidate, entry, 'bun', id);
      } finally {
        host.dispose();
        candidate.dispose();
      }
    },
  );
}

function unpackNpm(host: ObserverCandidate): string {
  const packageRoot = nodePath.join(observerRepo, 'packages/cli');
  const userConfig = nodePath.join(host.directory, 'npm-user.npmrc');
  const globalConfig = nodePath.join(host.directory, 'npm-global.npmrc');
  for (const path of [userConfig, globalConfig]) writeFileSync(path, '', { mode: 0o600 });
  const packed = JSON.parse(
    execFileSync(
      'npm',
      ['pack', '--ignore-scripts', '--offline', '--json', '--pack-destination', host.directory],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        env: {
          ...host.environment,
          npm_config_userconfig: userConfig,
          npm_config_globalconfig: globalConfig,
          npm_config_cache: nodePath.join(host.directory, 'npm-cache'),
        },
      },
    ),
  ) as { filename: string; files: { path: string }[] }[];
  const archive = packed[0];
  assert.ok(archive, 'npm pack must return an archive');
  assert.ok(
    archive?.files.some(file => file.path === 'dist/cli.js'),
    'Pack the actual npm distribution',
  );
  const destination = nodePath.join(host.root, 'packages/cli/dist/observer-npm');
  mkdirSync(destination, { recursive: true });
  execFileSync(
    'tar',
    ['-xzf', nodePath.join(host.directory, archive.filename), '-C', destination],
    { env: host.environment },
  );
  return nodePath.join(destination, 'package/dist/cli.js');
}

function unpackPreviousReader(host: ObserverCandidate): string {
  const destination = nodePath.join(host.directory, 'previous-main');
  mkdirSync(destination);
  const bytes = execFileSync(
    'git',
    ['archive', '--format=tar', 'f211c4c30fdb40e7fc5f342eaf981143c750db7b', 'plugin'],
    {
      cwd: observerRepo,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  execFileSync('tar', ['-xf', '-', '-C', destination], { input: bytes, env: host.environment });
  return nodePath.join(destination, 'plugin/runtime/cli.js');
}

void test(
  'unpacked npm proof binds its external runtime and survives command withdrawal',
  { timeout: 900_000 },
  () => {
    const candidate = createObserverCandidate();
    const host = createObserverCandidate();
    try {
      const entry = unpackNpm(host);
      const result = request(candidate, entry, 'node', ['observe-bounded-delivery']);
      expectCompleteObservation(result, candidate);
      const data = result.output.data;
      assert.ok(data);
      const id = data.attempt_id;
      verifyCurrent(candidate, entry, 'node', id);
      const terminalPath = nodePath.join(nodePath.dirname(data.report_path), 'terminal.json');
      const terminal = readFileSync(terminalPath);
      const report = readFileSync(data.report_path);
      const dependency = realpathSync(createRequire(entry).resolve('@cucumber/gherkin'));
      assert.ok(dependency.startsWith(`${realpathSync(host.root)}${nodePath.sep}`));
      const original = readFileSync(dependency);
      appendFileSync(dependency, '\n// Owned external npm dependency change.\n');
      const stale = request(candidate, entry, 'node', ['verify-bounded-delivery', id]);
      assert.equal(stale.exitCode, 2, 'Changed external npm dependency must stale retained proof');
      assert.equal(stale.output.data?.current, false);
      writeFileSync(dependency, original);
      verifyCurrent(candidate, entry, 'node', id);
      const beforeWithdrawal = attemptBytes(result);
      const previousReader = unpackPreviousReader(host);
      for (const operands of [['observe-bounded-delivery'], ['verify-bounded-delivery', id]]) {
        const withdrawn = request(candidate, previousReader, 'bun', operands);
        assert.notEqual(withdrawn.exitCode, 0);
        assert.ok(withdrawn.output.errors?.some(error => error.code === 'CLI_ARGUMENT_INVALID'));
        assert.deepEqual(
          attemptBytes(result),
          beforeWithdrawal,
          'A reader without the commands must preserve all retained attempt bytes',
        );
      }
      assert.deepEqual(readFileSync(terminalPath), terminal);
      assert.deepEqual(readFileSync(data.report_path), report);
      verifyCurrent(candidate, entry, 'node', id);
    } finally {
      host.dispose();
      candidate.dispose();
    }
  },
);
