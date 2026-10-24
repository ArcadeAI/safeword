/* eslint-disable vitest/no-import-node-test -- Runtime artifact checks stay outside every Vitest parent. */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  constants,
  cpSync,
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

import {
  auditReaderIdentity,
  sourceIdentity,
  treeIdentity,
} from '../../src/bounded-observation/identity.js';
import { controlledEnvironment } from '../../src/bounded-observation/tools.js';
import { createObserverCandidate, observerRepo } from '../fixtures/bounded-observation.js';
import { commitChangedInput } from '../fixtures/bounded-observation-currency.js';

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
    chmodSync(reader, 0o644);
    assert.notEqual(
      auditReaderIdentity(directory),
      before,
      'Removing owner execution must change reader identity',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('private Node dependency copies preserve normalized execution identity', () => {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'bounded-private-dependency-copy-'));
  try {
    const source = nodePath.join(directory, 'source');
    const copy = nodePath.join(directory, 'copy');
    mkdirSync(source);
    writeFileSync(nodePath.join(source, 'tool'), 'fixture');
    chmodSync(nodePath.join(source, 'tool'), 0o755);
    const previous = process.umask(0o077);
    try {
      cpSync(source, copy, { recursive: true, mode: constants.COPYFILE_FICLONE });
    } finally {
      process.umask(previous);
    }
    assert.equal(
      treeIdentity(source, '.'),
      treeIdentity(copy, '.'),
      'Private copied dependencies must retain normalized execution identity',
    );
    chmodSync(nodePath.join(copy, 'tool'), 0o600);
    assert.notEqual(
      treeIdentity(source, '.'),
      treeIdentity(copy, '.'),
      'Removing owner execution must stale dependency identity',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('a new reader cannot turn its execution input into an audit exemption', () => {
  const candidate = createObserverCandidate();
  const directory = candidate.root;
  const audit =
    '.project/tickets/PPHQN5-observe-bounded-delivery-proof/evidence/observer-audit-summary.md';
  try {
    const before = sourceIdentity(directory);
    assert.equal(
      Object.hasOwn(before, `file:${audit}`),
      false,
      'The pinned baseline must actually project audit output',
    );
    appendFileSync(nodePath.join(directory, audit), '\nAudit-only before the new reader.\n');
    assert.equal(
      sourceIdentity(directory)['source:tracked'],
      before['source:tracked'],
      'Audit-only edits must remain current before reader changes',
    );
    const reader = nodePath.join(directory, 'observer-input-reader');
    const marker = '\nTEST_LOADED_AUDIT_INPUT\n';
    writeFileSync(
      reader,
      `import {readFileSync} from 'node:fs'; process.stdout.write(readFileSync(${JSON.stringify(audit)}, 'utf8').includes(${JSON.stringify(marker)}) ? 'changed' : 'original');\n`,
    );
    chmodSync(reader, 0o755);
    commitChangedInput(candidate);
    assert.equal(execFileSync('node', [reader], { cwd: directory, encoding: 'utf8' }), 'original');
    const withReader = sourceIdentity(directory);
    assert.notEqual(
      withReader['source:audit-projection'],
      before['source:audit-projection'],
      'New reader must disable audit exemptions',
    );
    appendFileSync(nodePath.join(directory, audit), marker);
    assert.equal(execFileSync('node', [reader], { cwd: directory, encoding: 'utf8' }), 'changed');
    assert.notEqual(
      sourceIdentity(directory)['source:tracked'],
      withReader['source:tracked'],
      'Audit filename must not exempt a new loaded input',
    );
  } finally {
    candidate.dispose();
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
    assert.equal(
      environment.SAFEWORD_TEST_LOCK_DIR,
      undefined,
      'The lock directory must never be overridden',
    );
    assert.equal(
      environment.SAFEWORD_TEST_LOCK_MAX_WAIT_MS,
      '600000',
      'Fixed runner must wait for the normal lock within its operation budget',
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
