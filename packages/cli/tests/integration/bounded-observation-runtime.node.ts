/* eslint-disable vitest/no-import-node-test -- Runtime artifact checks stay outside every Vitest parent. */

import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { controlledEnvironment } from '../../src/bounded-observation/tools.js';
import { createObserverCandidate } from '../fixtures/bounded-observation.js';

void test('fixed runner preserves the host temporary root used by the shared test lock', () => {
  const prefix = nodePath.join(tmpdir(), 'bounded-lock-location-');
  const directory = mkdtempSync(prefix);
  try {
    const bin = nodePath.join(directory, 'bin');
    mkdirSync(bin);
    const environment = controlledEnvironment(
      { paths: {}, metadata: {}, identities: {} },
      bin,
      directory,
    );
    assert.equal(
      realpathSync(environment.TMPDIR ?? ''),
      realpathSync(tmpdir()),
      'Fixed runner must retain the existing shared-lock namespace',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('external runtime dependency bytes participate in runtime identity', async () => {
  const runtime = createObserverCandidate();
  try {
    const entry = nodePath.join(runtime.root, 'packages/cli/src/bounded-observation/tools.ts');
    const { runtimeIdentity } = (await import(pathToFileURL(entry).href)) as {
      runtimeIdentity: () => string;
    };
    const before = runtimeIdentity();
    const dependency = realpathSync(createRequire(entry).resolve('@cucumber/gherkin'));
    assert.ok(dependency.startsWith(`${realpathSync(runtime.root)}${nodePath.sep}`));
    appendFileSync(dependency, '\n// Owned runtime dependency currency control.\n');
    assert.notEqual(
      runtimeIdentity(),
      before,
      'Runtime identity must bind external dependency bytes',
    );
  } finally {
    runtime.dispose();
  }
});
