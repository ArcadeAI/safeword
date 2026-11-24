import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';

import { writeDurableFile, writeDurableFileExclusive } from '../codex-plugin/durable-write.js';
import { retrospectiveCloseTag, validRetrospectiveCloseTag } from './job.js';
import { SOULLESS_RETROSPECTIVE_POLICY } from './retrospective-policy.js';
import { proofSha256 } from './retrospective-proof.js';

export interface ElectronReplayIdentity {
  readonly proofId: string;
  readonly scenario: string;
  readonly inputSha256: string;
}

interface ReplayRecord {
  readonly schema_version: 1;
  readonly policySha256: string;
  readonly identity: ElectronReplayIdentity;
  readonly commit: string;
  readonly owner: string;
  readonly state: 'pending' | 'passed' | 'failed';
  readonly failure: string;
}

function recordPaths(root: string, identity: ElectronReplayIdentity) {
  if (
    !/^[a-f\d-]{36}$/u.test(identity.proofId) ||
    !/^[a-f\d]{64}$/u.test(identity.inputSha256) ||
    !([...SOULLESS_RETROSPECTIVE_POLICY.scenarios] as string[]).includes(identity.scenario)
  )
    throw new Error('Electron replay identity is outside the enrolled policy.');
  // Deliberately exclude eligibility, input digest, and HEAD: changing them must
  // never provide a retry path around a failed or interrupted proof-review ID.
  const key = proofSha256(
    JSON.stringify([realpathSync.native(root), SOULLESS_RETROSPECTIVE_POLICY.id, identity.proofId]),
  );
  const record = path.join(root, '.safeword/state/reviews', `electron-replay-${key}.json`);
  return { record, lock: `${record}.lock` };
}

function policyDigest(): string {
  return proofSha256(JSON.stringify(SOULLESS_RETROSPECTIVE_POLICY));
}

function signed(root: string, record: ReplayRecord): string {
  const content = JSON.stringify(record);
  return `${JSON.stringify({
    record,
    integrity: retrospectiveCloseTag(root, `electron-replay-v1\0${content}`),
  })}\n`;
}

function readRecord(root: string, file: string, identity: ElectronReplayIdentity): ReplayRecord {
  const envelope = JSON.parse(readFileSync(file, 'utf8')) as {
    record: ReplayRecord;
    integrity: string;
  };
  const record = envelope.record;
  if (
    !validRetrospectiveCloseTag(
      root,
      `electron-replay-v1\0${JSON.stringify(record)}`,
      envelope.integrity,
    ) ||
    record.schema_version !== 1 ||
    record.policySha256 !== policyDigest() ||
    JSON.stringify(record.identity) !== JSON.stringify(identity) ||
    !['pending', 'passed', 'failed'].includes(record.state)
  )
    throw new Error('Electron replay journal is invalid; obtain a fresh proof review.');
  return record;
}

function requireOwner(root: string, lock: string, pending: ReplayRecord): void {
  if (readFileSync(lock, 'utf8') !== signed(root, pending))
    throw new Error('Electron replay ownership changed; no authorization was written.');
}

/** A pending/failed proof review never becomes reusable, even at another HEAD. */
export async function withElectronReplay<T>(
  root: string,
  identity: ElectronReplayIdentity,
  commit: string,
  execute: () => Promise<T>,
): Promise<T> {
  if (!/^[a-f\d]{40}$/u.test(commit)) throw new Error('Electron replay needs a committed view.');
  const files = recordPaths(root, identity);
  const pending: ReplayRecord = {
    schema_version: 1,
    policySha256: policyDigest(),
    identity,
    commit,
    owner: randomUUID(),
    state: 'pending',
    failure: '',
  };
  writeDurableFileExclusive(files.lock, signed(root, pending), { mode: 0o600 });
  let release = false;
  try {
    if (existsSync(files.record) && readRecord(root, files.record, identity).state !== 'passed')
      throw new Error(
        'Electron replay previously failed or was interrupted; obtain a fresh proof review.',
      );
    writeDurableFile(files.record, signed(root, pending), { mode: 0o600 });
    let result: T;
    try {
      result = await execute();
    } catch (error: unknown) {
      requireOwner(root, files.lock, pending);
      writeDurableFile(
        files.record,
        signed(root, {
          ...pending,
          state: 'failed',
          failure:
            error instanceof Error ? error.message.slice(0, 2000) : 'Electron replay failed.',
        }),
        { mode: 0o600 },
      );
      release = true;
      throw error;
    }
    requireOwner(root, files.lock, pending);
    writeDurableFile(files.record, signed(root, { ...pending, state: 'passed' }), { mode: 0o600 });
    release = true;
    return result;
  } finally {
    // Failed durable publication retains the lock, so an uncertain write can
    // never make an older passed record authorize a later failed invocation.
    if (release) rmSync(files.lock);
  }
}

/** Cheap gate readers must consult this journal even when an older row tag exists. */
export function hasPassedElectronReplay(
  root: string,
  identity: ElectronReplayIdentity,
  commit: string,
): boolean {
  try {
    const files = recordPaths(root, identity);
    if (existsSync(files.lock)) return false;
    const record = readRecord(root, files.record, identity);
    return record.state === 'passed' && record.commit === commit;
  } catch {
    return false;
  }
}
