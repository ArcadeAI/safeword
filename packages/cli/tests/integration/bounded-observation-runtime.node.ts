/* eslint-disable vitest/no-import-node-test -- Runtime artifact checks stay outside every Vitest parent. */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { auditReaderIdentity, sourceIdentity } from '../../src/bounded-observation/identity.js';
import { controlledEnvironment } from '../../src/bounded-observation/tools.js';
import { createObserverCandidate, observerRepo } from '../fixtures/bounded-observation.js';

void test('the shipped audit reader identity matches this reviewed source and configuration', () => {
  const path = nodePath.join(
    observerRepo,
    'packages/cli/src/bounded-observation/audit-readers.json',
  );
  const policy = JSON.parse(readFileSync(path, 'utf8')) as { source_sha256: string };
  assert.equal(
    auditReaderIdentity(observerRepo),
    policy.source_sha256,
    'Review changed readers, refresh the shipped identity, and regenerate the bundles',
  );
});

void test('reader identity preserves Git executable semantics across a private checkout', () => {
  const prefix = nodePath.join(tmpdir(), 'bounded-reader-mode-');
  const directory = mkdtempSync(prefix);
  try {
    const reader = nodePath.join(directory, 'reader.mjs');
    writeFileSync(reader, 'export const value = 1;\n');
    chmodSync(reader, 0o755);
    execFileSync('git', ['init', '--quiet', '--template='], { cwd: directory });
    execFileSync('git', ['add', '.'], { cwd: directory });
    const before = auditReaderIdentity(directory);
    chmodSync(reader, 0o700);
    assert.equal(
      auditReaderIdentity(directory),
      before,
      'Reader identity must normalize executable mode as Git does',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('a new reader cannot turn its execution input into an audit exemption', () => {
  const prefix = nodePath.join(tmpdir(), 'bounded-loaded-audit-');
  const directory = mkdtempSync(prefix);
  const audit =
    '.project/tickets/PPHQN5-observe-bounded-delivery-proof/evidence/observer-audit-summary.md';
  try {
    mkdirSync(nodePath.join(directory, nodePath.dirname(audit)), { recursive: true });
    writeFileSync(nodePath.join(directory, audit), 'safe');
    const reader = nodePath.join(directory, 'reader.mjs');
    writeFileSync(
      reader,
      `import {readFileSync} from 'node:fs'; process.stdout.write(readFileSync(${JSON.stringify(audit)}));\n`,
    );
    execFileSync('git', ['init', '--quiet', '--template='], { cwd: directory });
    execFileSync('git', ['add', '.'], { cwd: directory });
    assert.equal(execFileSync('node', [reader], { cwd: directory, encoding: 'utf8' }), 'safe');
    const before = sourceIdentity(directory);
    writeFileSync(nodePath.join(directory, audit), 'changed');
    assert.equal(execFileSync('node', [reader], { cwd: directory, encoding: 'utf8' }), 'changed');
    assert.notDeepEqual(
      sourceIdentity(directory),
      before,
      'Audit filename must not exempt a new loaded input',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

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
