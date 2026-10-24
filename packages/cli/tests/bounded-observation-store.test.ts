import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { profileSha256, purpose } from '../src/bounded-observation/contract.js';
import {
  artifactDigests,
  attemptPath,
  type AttemptStart,
  type AttemptStore,
  openStore,
  publishRecord,
  readRecord,
  reserveAttempt,
} from '../src/bounded-observation/store.js';

const temporary: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture(): {
  root: string;
  store: AttemptStore;
  id: string;
  directory: string;
  value: AttemptStart;
} {
  const prefix = nodePath.join(tmpdir(), 'bounded-record-test-');
  const parent = realpathSync(mkdtempSync(prefix));
  temporary.push(parent);
  const root = nodePath.join(parent, 'checkout');
  mkdirSync(root);
  vi.stubEnv('XDG_STATE_HOME', nodePath.join(parent, 'state'));
  const store = openStore(root, true);
  const { id, directory } = reserveAttempt(store);
  return {
    root,
    store,
    id,
    directory,
    value: {
      schema_version: 1,
      purpose,
      authority: 'execution-only',
      ticket: 'T3E4NS',
      root,
      attempt_id: id,
      candidate_commit: 'fixture-only',
      profile_sha256: profileSha256,
      runtime_sha256: 'fixture-only',
      inputs: {},
      command: { public_argv: [], runner_argv: [] },
      clone: '/fixture-only',
      started_at: '2026-10-24T00:00:00Z',
    },
  };
}

it('reads an authenticated record without changing its bytes or directory', () => {
  const { root, store, id, directory, value } = fixture();
  publishRecord(store, directory, 'start', value);
  const path = nodePath.join(directory, 'start.json');
  const before = readFileSync(path);
  expect(readRecord(store, directory, 'start', root, id)).toEqual(value);
  expect(readRecord(store, directory, 'start', root, id)).toEqual(value);
  expect(readFileSync(path)).toEqual(before);
  expect(readdirSync(directory)).toEqual(['start.json']);
});

it.each([
  ['schema_version', 2],
  ['purpose', 'another-purpose'],
  ['authority', 'closing'],
  ['ticket', '82T411'],
  ['root', '/another-root'],
  ['attempt_id', 'another-attempt'],
  ['profile_sha256', 'another-profile'],
])('rejects an authenticated incompatible %s', (field, replacement) => {
  const { root, store, id, directory, value } = fixture();
  const changed = { ...value, [field]: replacement } as AttemptStart;
  publishRecord(store, directory, 'start', changed);
  expect(() => readRecord(store, directory, 'start', root, id)).toThrow(`(${field})`);
});

it('rejects changed payload bytes even with a well-formed old tag', () => {
  const { root, store, id, directory, value } = fixture();
  publishRecord(store, directory, 'start', value);
  const path = nodePath.join(directory, 'start.json');
  const bytes = readFileSync(path, 'utf8');
  writeFileSync(path, bytes.replace('fixture-only', 'tampered'));
  expect(() => readRecord(store, directory, 'start', root, id)).toThrow('authentication failed');
});

it('rejects a replaced private key without rewriting the record', () => {
  const { root, store, id, directory, value } = fixture();
  publishRecord(store, directory, 'start', value);
  const before = readFileSync(nodePath.join(directory, 'start.json'));
  writeFileSync(nodePath.join(store.base, 'observer.key'), Buffer.alloc(32, 1));
  expect(() => readRecord(openStore(root, false), directory, 'start', root, id)).toThrow(
    'authentication failed',
  );
  expect(readFileSync(nodePath.join(directory, 'start.json'))).toEqual(before);
});

it('never overwrites an already published START', () => {
  const { root, store, id, directory, value } = fixture();
  publishRecord(store, directory, 'start', value);
  expect(() => {
    publishRecord(store, directory, 'start', { ...value, candidate_commit: 'replacement' });
  }).toThrow();
  expect(readRecord(store, directory, 'start', root, id)).toEqual(value);
});

it('allocates distinct independent attempts without depending on process IDs', () => {
  const { store, id, directory } = fixture();
  const next = reserveAttempt(store);
  expect(next.id).not.toBe(id);
  expect(next.directory).not.toBe(directory);
  expect(readdirSync(directory)).toEqual([]);
});

it.each(['../escape', '', '11111111-1111-1111-1111-111111111111'])(
  'rejects unsafe attempt ID %j',
  id => {
    expect(() => attemptPath(fixture().store, id)).toThrow('Unsafe attempt identity');
  },
);

it('rejects a symlinked attempt directory', () => {
  const { store, directory, id } = fixture();
  rmSync(directory, { recursive: true });
  symlinkSync(store.base, directory, 'dir');
  expect(() => attemptPath(store, id)).toThrow('Unsafe attempt directory');
});

it('rejects symlinked or public artifact files', () => {
  const { directory } = fixture();
  const source = nodePath.join(directory, 'private.txt');
  writeFileSync(source, 'private', { mode: 0o600 });
  const report = nodePath.join(directory, 'report.json');
  symlinkSync(source, report);
  expect(() => artifactDigests(directory)).toThrow();
  rmSync(report);
  writeFileSync(report, 'report', { mode: 0o600 });
  chmodSync(report, 0o644);
  expect(() => artifactDigests(directory)).toThrow('Unsafe evidence file');
});

it('does not publish success when exclusive publication fails', () => {
  const { store, directory, value } = fixture();
  mkdirSync(nodePath.join(directory, 'start.json'));
  expect(() => {
    publishRecord(store, directory, 'start', value);
  }).toThrow();
  expect(readdirSync(directory)).toEqual(['start.json']);
});
