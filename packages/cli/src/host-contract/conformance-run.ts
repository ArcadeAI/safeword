import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { writeDurableFile, writeDurableFileExclusive } from '../codex-plugin/durable-write.js';
import { acquireProfileLock, releaseProfileLock } from '../utils/profile-lock.js';

export interface ConformanceStore {
  readonly directory: string;
  readonly keyFile: string;
  readonly headFile: string;
}
export interface SealedConformanceAttempt {
  readonly schema_version: 1;
  readonly id: string;
  readonly order: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly integrity: string;
}
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
function key(store: ConformanceStore): Buffer {
  const value = readFileSync(store.keyFile);
  if (value.length !== 32) throw new Error('Invalid conformance integrity key');
  return value;
}
function tag(store: ConformanceStore, value: unknown): string {
  return createHmac('sha256', key(store))
    .update(realpathSync(store.directory))
    .update('\0')
    .update(JSON.stringify(value))
    .digest('hex');
}
function records(store: ConformanceStore): SealedConformanceAttempt[] {
  const result = readdirSync(store.directory)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      const record = JSON.parse(
        readFileSync(nodePath.join(store.directory, name), 'utf8'),
      ) as SealedConformanceAttempt;
      const { integrity, ...body } = record;
      if (
        body.schema_version !== 1 ||
        typeof body.id !== 'string' ||
        !Number.isSafeInteger(body.order) ||
        body.order < 1 ||
        name !== `${digest(body.id)}.json` ||
        !/^[a-f\d]{64}$/u.test(integrity) ||
        !timingSafeEqual(Buffer.from(integrity, 'hex'), Buffer.from(tag(store, body), 'hex'))
      )
        throw new Error('Invalid sealed conformance attempt');
      return record;
    })
    .toSorted((a, b) => a.order - b.order);
  if (result.some((record, index) => record.order !== index + 1))
    throw new Error('Invalid conformance history order');
  return result;
}
/** A missing/corrupt key, head fence or record is unavailable; a read never creates state. */
export function readConformanceAttempts(
  store: ConformanceStore,
): readonly SealedConformanceAttempt[] | undefined {
  try {
    const result = records(store);
    const { integrity, ...head } = JSON.parse(readFileSync(store.headFile, 'utf8')) as {
      integrity: string;
      id: string;
      order: number;
      pending: boolean;
    };
    if (
      head.pending ||
      integrity !== tag(store, head) ||
      result.at(-1)?.id !== head.id ||
      result.at(-1)?.order !== head.order
    )
      return undefined;
    return result;
  } catch {
    return undefined;
  }
}
function ensureKey(store: ConformanceStore): void {
  if (existsSync(store.keyFile)) return;
  if (
    existsSync(nodePath.dirname(store.headFile)) ||
    readdirSync(store.directory).some(name => name.endsWith('.json'))
  )
    throw new Error(
      'Conformance integrity key missing; restore the original profile key before retrying. History was preserved.',
    );
  try {
    writeDurableFileExclusive(store.keyFile, randomBytes(32), { mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
}
function publishHead(
  store: ConformanceStore,
  record: SealedConformanceAttempt,
  pending: boolean,
): void {
  const value = { id: record.id, order: record.order, pending };
  writeDurableFile(store.headFile, JSON.stringify({ ...value, integrity: tag(store, value) }), {
    mode: 0o600,
  });
}
function reuseAttempt(
  store: ConformanceStore,
  record: SealedConformanceAttempt,
  payload: unknown,
  latest: SealedConformanceAttempt | undefined,
): void {
  if (!isDeepStrictEqual(record.payload, payload))
    throw new Error('Conflicting conformance attempt ID');
  const { integrity, ...current } = JSON.parse(readFileSync(store.headFile, 'utf8'));
  if (
    integrity !== tag(store, current) ||
    current.id !== latest?.id ||
    current.order !== latest?.order
  )
    throw new Error('Invalid conformance head');
  if (current.pending && current.id === record.id && current.order === record.order)
    publishHead(store, record, false);
}
/** Only a signed pending fence is recoverable; deletion of completed history still fails. */
function recoverPending(store: ConformanceStore, prior: SealedConformanceAttempt[]): void {
  if (!existsSync(store.headFile)) return;
  const { integrity, ...head } = JSON.parse(readFileSync(store.headFile, 'utf8'));
  if (integrity !== tag(store, head)) throw new Error('Invalid conformance head');
  if (!head.pending) return;
  const latest = prior.at(-1);
  if (latest && head.id === latest.id && head.order === latest.order) {
    publishHead(store, latest, false);
    return;
  }
  if (head.order !== prior.length + 1 || typeof head.id !== 'string')
    throw new Error('Invalid pending conformance head');
  const body = {
    schema_version: 1 as const,
    id: head.id as string,
    order: head.order as number,
    payload: { outcome: 'unavailable', reason: 'publication-interrupted' },
  };
  const record = { ...body, integrity: tag(store, body) };
  writeDurableFileExclusive(
    nodePath.join(store.directory, `${digest(record.id)}.json`),
    JSON.stringify(record),
    { mode: 0o600 },
  );
  publishHead(store, record, false);
  prior.push(record);
}
/** Internal controller publication only; there is no success-JSON CLI entrypoint. */
export function publishConformanceAttempt(
  store: ConformanceStore,
  payload: Readonly<Record<string, unknown>>,
  id: string = randomUUID(),
): SealedConformanceAttempt {
  mkdirSync(store.directory, { recursive: true });
  const lock = acquireProfileLock(nodePath.join(store.directory, 'publication.lock'));
  if (!lock) throw new Error('Conformance publication is busy');
  try {
    ensureKey(store);
    const prior = records(store),
      encoded = JSON.stringify(payload);
    recoverPending(store, prior);
    const normalized = JSON.parse(encoded) as Readonly<Record<string, unknown>>;
    const duplicate = prior.find(record => record.id === id);
    if (duplicate) {
      reuseAttempt(store, duplicate, normalized, prior.at(-1));
      return duplicate;
    }
    if ((prior.length > 0 || existsSync(store.headFile)) && !readConformanceAttempts(store))
      throw new Error('Invalid conformance head; existing history was preserved');
    const body = {
      schema_version: 1 as const,
      id,
      order: (prior.at(-1)?.order ?? 0) + 1,
      payload: normalized,
    };
    const record = { ...body, integrity: tag(store, body) };
    // Fence first: deletion or a crash cannot reveal an older success as current.
    publishHead(store, record, true);
    writeDurableFileExclusive(
      nodePath.join(store.directory, `${digest(id)}.json`),
      JSON.stringify(record),
      { mode: 0o600 },
    );
    publishHead(store, record, false);
    return record;
  } finally {
    releaseProfileLock(lock);
  }
}
