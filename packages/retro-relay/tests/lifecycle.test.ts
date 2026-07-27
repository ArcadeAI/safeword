import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { CredentialRegistry } from '../src/auth.js';
import { GitHubRestClient } from '../src/github.js';
import { startRelayServer } from '../src/http-server.js';
import { RelayStore } from '../src/store.js';
import type { RequestScope } from '../src/types.js';

const directories: string[] = [];

afterEach(() => {
  const usedDirectories = [...directories];
  directories.length = 0;
  for (const directory of usedDirectories) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-relay-lifecycle-'));
  directories.push(directory);
  return path.join(directory, 'relay.sqlite');
}

function scope(requestId: string): RequestScope {
  return {
    installationId: 42,
    repository: 'arcadeai/safeword',
    requestId,
    tenantId: 'tenant-1',
  };
}

function accept(store: RelayStore, requestId: string) {
  return store.accept({
    envelope: {
      ciphertext: Buffer.from(`ciphertext-${requestId}`),
      nonce: Buffer.alloc(12, 1),
      tag: Buffer.alloc(16, 2),
    },
    payloadHash: `hash-${requestId}`,
    requestMarker: `<!-- request:${requestId} -->`,
    scope: scope(requestId),
  });
}

function createVersionOne(databaseFile: string): void {
  const database = new Database(databaseFile);
  database.exec(`
    CREATE TABLE schema_version (version INTEGER NOT NULL) STRICT;
    INSERT INTO schema_version VALUES (1);
    CREATE TABLE retro_requests (
      tenant_id TEXT NOT NULL,
      installation_id INTEGER NOT NULL,
      repository TEXT NOT NULL,
      request_id TEXT NOT NULL,
      receipt_id TEXT NOT NULL UNIQUE,
      payload_hash TEXT NOT NULL,
      payload_nonce BLOB NOT NULL,
      payload_ciphertext BLOB NOT NULL,
      payload_tag BLOB NOT NULL,
      state TEXT NOT NULL,
      issue_number INTEGER,
      request_marker TEXT NOT NULL,
      alias_owner_request_id TEXT,
      accepted_at TEXT NOT NULL,
      filed_at TEXT,
      PRIMARY KEY (tenant_id, installation_id, repository, request_id)
    ) STRICT;
    CREATE TABLE semantic_evidence (
      kind TEXT NOT NULL,
      value TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      installation_id INTEGER NOT NULL,
      repository TEXT NOT NULL,
      request_id TEXT NOT NULL,
      PRIMARY KEY (tenant_id, installation_id, repository, kind, value)
    ) STRICT;
    CREATE TABLE reconciliation_audit (
      audit_id INTEGER PRIMARY KEY,
      receipt_id TEXT NOT NULL,
      actor_subject TEXT NOT NULL,
      disposition TEXT NOT NULL,
      match_count INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    ) STRICT;
  `);
  database.close();
}

describe('schema version two migration', () => {
  it('rolls back every migration mutation when an injected step fails', () => {
    const file = databasePath();
    createVersionOne(file);

    expect(() =>
      RelayStore.open(file, {
        migrationFault: step => {
          if (step === 'after-columns') throw new Error('injected migration crash');
        },
      }),
    ).toThrow('injected migration crash');

    const database = new Database(file, { readonly: true });
    expect(
      database.prepare<[], { version: number }>('SELECT version FROM schema_version').get()
        ?.version,
    ).toBe(1);
    const columns = database
      .prepare<[], { name: string }>('PRAGMA table_info(retro_requests)')
      .all();
    expect(columns.map(column => column.name)).not.toContain('dead_lettered_at');
    database.close();

    const migrated = RelayStore.open(file);
    expect(migrated.schemaVersion()).toBe(2);
    migrated.close();
  });

  it.each(['partial', 'newer', 'duplicate-version', 'missing-version'] as const)(
    'rejects %s schema metadata before use',
    condition => {
      const file = databasePath();
      createVersionOne(file);
      const database = new Database(file);
      switch (condition) {
        case 'partial': {
          database.exec('ALTER TABLE retro_requests ADD COLUMN dead_lettered_at TEXT;');
          break;
        }
        case 'newer': {
          database.exec('UPDATE schema_version SET version = 99;');
          break;
        }
        case 'duplicate-version': {
          database.exec('INSERT INTO schema_version VALUES (1);');
          break;
        }
        case 'missing-version': {
          database.exec('DELETE FROM schema_version;');
          break;
        }
      }
      database.close();

      expect(() => RelayStore.open(file)).toThrow(/schema/u);
    },
  );
});

describe('durable retry and terminal lifecycle', () => {
  it('persists due scheduling and exponential backoff across restart', () => {
    const file = databasePath();
    let now = new Date('2026-01-01T00:00:00.000Z');
    let store = RelayStore.open(file, { now: () => now });
    accept(store, 'due');
    accept(store, 'not-due');
    expect(store.claim(scope('due'), now)).toBe(true);
    store.markRetryable(scope('due'), now);
    expect(store.claim(scope('not-due'), now)).toBe(true);
    now = new Date(now.getTime() + 30_000);
    store.markRetryable(scope('not-due'), now);
    store.close();

    now = new Date('2026-01-01T00:01:00.000Z');
    store = RelayStore.open(file, { now: () => now });
    expect(store.claimDueRetries(now, 10).map(item => item.scope.requestId)).toEqual(['due']);
    store.markRetryable(scope('due'), now);
    expect(store.load(scope('due'))?.attemptCount).toBe(2);
    expect(store.load(scope('due'))?.nextAttemptAt).toBe('2026-01-01T00:03:00.000Z');
    store.close();
  });

  it('prevents a new dispatch at 24 hours and dead-letters exactly once', () => {
    const file = databasePath();
    const acceptedAt = new Date('2026-01-01T00:00:00.000Z');
    const store = RelayStore.open(file, { now: () => acceptedAt });
    accept(store, 'deadline');
    const deadline = new Date('2026-01-02T00:00:00.000Z');

    expect(store.claim(scope('deadline'), deadline)).toBe(false);
    const first = store.maintain(deadline);
    const second = store.maintain(deadline);
    expect(store.receipt(scope('deadline'))?.state).toBe('dead-letter');
    expect(first.alerts).toHaveLength(1);
    expect(second.alerts).toHaveLength(0);
    expect(store.pendingAlerts()).toHaveLength(1);
    store.close();
  });

  it('allows exactly one filed or ambiguous winner at the 25-hour CAS boundary', () => {
    for (const winner of ['filed', 'ambiguous'] as const) {
      const file = databasePath();
      const acceptedAt = new Date('2026-01-01T00:00:00.000Z');
      const store = RelayStore.open(file, { now: () => acceptedAt });
      accept(store, winner);
      const beforeDeadline = new Date('2026-01-01T23:59:59.999Z');
      expect(store.claim(scope(winner), beforeDeadline)).toBe(true);
      expect(store.beginDispatch(scope(winner), beforeDeadline)).toBe(true);
      const graceEnd = new Date('2026-01-02T01:00:00.000Z');

      if (winner === 'filed') {
        const beforeGraceEnd = new Date(graceEnd.getTime() - 1);
        expect(store.markFiled(scope(winner), 1479, beforeGraceEnd)).toMatchObject({
          state: 'filed',
        });
        store.maintain(graceEnd);
      } else {
        store.maintain(graceEnd);
        expect(() => store.markFiled(scope(winner), 1479, graceEnd)).toThrow(
          'filing transition lost',
        );
      }
      expect(store.receipt(scope(winner))?.state).toBe(winner);
      store.close();
    }
  });

  it('compacts payload access at 30 days while retaining identity and semantic evidence', () => {
    const file = databasePath();
    const acceptedAt = new Date('2026-01-01T00:00:00.000Z');
    let store = RelayStore.open(file, { now: () => acceptedAt });
    accept(store, 'retained');
    store.claim(scope('retained'), acceptedAt);
    store.reserveEvidence(scope('retained'), [
      { kind: 'canonical', value: 'canonical:retained' },
      { kind: 'legacy', value: 'retro:retained' },
    ]);
    store.beginDispatch(scope('retained'), acceptedAt);
    store.markFiled(scope('retained'), 1479, acceptedAt);
    store.maintain(new Date('2026-01-31T00:00:00.000Z'));
    store.checkpoint();
    store.close();

    store = RelayStore.open(file);
    const record = store.load(scope('retained'));
    expect(record?.state).toBe('tombstone');
    expect(record?.envelope.ciphertext).toHaveLength(0);
    expect(store.evidenceOwner('canonical', 'canonical:retained')?.scope.requestId).toBe(
      'retained',
    );
    expect(store.evidenceOwner('legacy', 'retro:retained')?.scope.requestId).toBe('retained');
    store.close();
  });

  it('reports lifecycle counts and stable deduplicable alert event IDs', () => {
    const file = databasePath();
    const acceptedAt = new Date('2026-01-01T00:00:00.000Z');
    let store = RelayStore.open(file, { now: () => acceptedAt });
    accept(store, 'alerted');
    const deadline = new Date('2026-01-02T00:00:00.000Z');
    store.maintain(deadline);
    const beforeRestart = store.pendingAlerts();
    const operations = store.operations(deadline);
    expect(operations.counts['dead-letter']).toBe(1);
    expect(JSON.stringify(operations)).not.toContain('ciphertext-alerted');
    store.close();

    store = RelayStore.open(file);
    expect(store.pendingAlerts()).toEqual(beforeRestart);
    expect(beforeRestart[0]?.eventId).toMatch(/^[0-9a-f]{64}$/u);
    store.close();
  });

  it('atomically records an alert when a request becomes immediately ambiguous', () => {
    const file = databasePath();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const store = RelayStore.open(file, { now: () => now });
    accept(store, 'immediate-ambiguity');
    expect(store.claim(scope('immediate-ambiguity'), now)).toBe(true);

    store.markAmbiguous(scope('immediate-ambiguity'));

    expect(store.receipt(scope('immediate-ambiguity'))?.state).toBe('ambiguous');
    expect(store.pendingAlerts()).toEqual([
      expect.objectContaining({
        receiptId: expect.any(String),
        state: 'ambiguous',
      }),
    ]);
    store.close();
  });

  it('redelivers the same alert event ID after a crash-after-log window', async () => {
    const file = databasePath();
    const acceptedAt = new Date('2026-01-01T00:00:00.000Z');
    const store = RelayStore.open(file, { now: () => acceptedAt });
    accept(store, 'alert-retry');
    const observed: string[] = [];
    let failAfterLog = true;
    const relay = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: new CredentialRegistry('pepper'),
      github: new GitHubRestClient({
        baseUrl: 'https://github.invalid',
        installationToken: () => Promise.reject(new Error('must not call GitHub')),
      }),
      onAlert: event => {
        observed.push(event.eventId);
        if (failAfterLog) {
          failAfterLog = false;
          throw new Error('crash after logger write');
        }
      },
      payloadKey: Buffer.alloc(32, 7),
      store,
    });

    const deadline = new Date('2026-01-02T00:00:00.000Z');
    await relay.maintain(deadline);
    expect(store.pendingAlerts()).toHaveLength(1);
    await relay.maintain(deadline);
    expect(observed).toHaveLength(2);
    expect(new Set(observed).size).toBe(1);
    expect(store.pendingAlerts()).toHaveLength(0);

    await new Promise<void>(resolve =>
      relay.server.close(() => {
        resolve();
      }),
    );
    store.close();
  });
});
