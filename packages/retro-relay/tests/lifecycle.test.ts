import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CredentialRegistry } from '../src/auth.js';
import { GitHubRestClient } from '../src/github.js';
import { startRelayServer } from '../src/http-server.js';
import Database from '../src/sqlite.js';
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
      formatVersion: 2,
      keyId: 'test',
      nonce: Buffer.alloc(12, 1),
      tag: Buffer.alloc(16, 2),
    },
    payloadHash: `hash-${requestId}`,
    requestMarker: `<!-- request:${requestId} -->`,
    retryDeadlineAt: '2099-01-01T00:00:00.000Z',
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
      accepted_at TEXT NOT NULL,
      filed_at TEXT,
      PRIMARY KEY (tenant_id, installation_id, repository, request_id)
    ) STRICT;
    CREATE TABLE reconciliation_audit (
      audit_id INTEGER PRIMARY KEY,
      receipt_id TEXT NOT NULL,
      actor_subject TEXT NOT NULL,
      disposition TEXT NOT NULL,
      match_count INTEGER NOT NULL,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (receipt_id) REFERENCES retro_requests (receipt_id)
    ) STRICT;
    INSERT INTO retro_requests (
      tenant_id, installation_id, repository, request_id, receipt_id,
      payload_hash, payload_nonce, payload_ciphertext, payload_tag, state,
      issue_number, request_marker, accepted_at, filed_at
    ) VALUES (
      'tenant-1', 42, 'arcadeai/safeword', 'migrated-v1', 'receipt-v1',
      'hash-v1', x'01', x'02', x'03', 'filed',
      41, '<!-- request:migrated-v1 -->', '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:01:00.000Z'
    );
    INSERT INTO reconciliation_audit (
      receipt_id, actor_subject, disposition, match_count, recorded_at
    ) VALUES (
      'receipt-v1', 'operator', 'adopted', 1, '2026-01-01T00:01:00.000Z'
    );
  `);
  database.close();
}

function createVersionTwo(databaseFile: string): void {
  createVersionOne(databaseFile);
  const database = new Database(databaseFile);
  database.exec(`
    ALTER TABLE retro_requests ADD COLUMN dead_lettered_at TEXT;
    ALTER TABLE retro_requests ADD COLUMN tombstoned_at TEXT;
    ALTER TABLE retro_requests ADD COLUMN payload_compacted_at TEXT;
    ALTER TABLE retro_requests ADD COLUMN next_attempt_at TEXT;
    ALTER TABLE retro_requests ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE retro_requests ADD COLUMN dispatch_started_at TEXT;
    CREATE TABLE alert_outbox (
      event_id TEXT PRIMARY KEY,
      receipt_id TEXT NOT NULL,
      state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      delivered_at TEXT,
      FOREIGN KEY (receipt_id) REFERENCES retro_requests (receipt_id)
    ) STRICT;
    INSERT INTO alert_outbox (
      event_id, receipt_id, state, created_at, delivered_at
    ) VALUES (
      'alert-v2', 'receipt-v1', 'ambiguous', '2026-01-01T00:02:00.000Z', NULL
    );
    INSERT INTO retro_requests (
      tenant_id, installation_id, repository, request_id, receipt_id,
      payload_hash, payload_nonce, payload_ciphertext, payload_tag, state,
      issue_number, request_marker, accepted_at, filed_at, next_attempt_at
    ) VALUES (
      'tenant-1', 42, 'arcadeai/safeword', 'migrated-v2', 'receipt-v2',
      'hash-v2', x'01', x'02', x'03', 'accepted',
      NULL, '<!-- request:migrated-v2 -->', '2026-01-01T00:00:00.000Z', NULL,
      '2026-01-01T00:00:00.000Z'
    );
    UPDATE schema_version SET version = 2;
  `);
  database.close();
}

function createVersionThree(databaseFile: string): void {
  createVersionTwo(databaseFile);
  const database = new Database(databaseFile);
  database.exec(`
    ALTER TABLE retro_requests ADD COLUMN retry_deadline_at
      TEXT NOT NULL DEFAULT '2026-01-02T00:00:00.000Z';
    UPDATE schema_version SET version = 3;
  `);
  database.close();
}

describe('schema version four migration', () => {
  it('preserves the original transaction error when SQLite has already rolled back', () => {
    const database = new Database(':memory:');
    const original = new Error('original transaction failure');

    expect(() =>
      database.immediateTransaction(() => {
        database.exec('ROLLBACK;');
        throw original;
      }),
    ).toThrow(original);
    database.close();
  });

  it('[ORR-028] rolls back every migration mutation when an injected step fails', () => {
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
    expect(migrated.schemaVersion()).toBe(4);
    migrated.close();
  });

  it.each(['partial', 'newer', 'duplicate-version', 'missing-version'] as const)(
    '[ORR-029] rejects %s schema metadata before use',
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

  it('upgrades the deployed version-two layout with a durable retry deadline', () => {
    const file = databasePath();
    createVersionTwo(file);
    const legacy = new Database(file);
    legacy
      .prepare("UPDATE retro_requests SET next_attempt_at = NULL WHERE request_id = 'migrated-v2'")
      .run();
    legacy.close();

    const store = RelayStore.open(file);

    expect(store.schemaVersion()).toBe(4);
    expect(store.load(scope('migrated-v2'))).toMatchObject({
      envelope: { formatVersion: 1, keyId: 'legacy' },
      nextAttemptAt: '2026-01-01T00:00:00.000Z',
      retryDeadlineAt: '2026-01-02T00:00:00.000Z',
    });
    expect(
      store
        .claimDueRetries(new Date('2026-01-01T00:00:00.000Z'))
        .map(record => record.scope.requestId),
    ).toContain('migrated-v2');
    store.close();
  });

  it('repairs a current-schema NULL retry schedule on every open', () => {
    const file = databasePath();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const store = RelayStore.open(file, { now: () => now });
    accept(store, 'current-null');
    store.close();
    const damaged = new Database(file);
    damaged
      .prepare("UPDATE retro_requests SET next_attempt_at = NULL WHERE request_id = 'current-null'")
      .run();
    damaged.close();

    const repaired = RelayStore.open(file);

    expect(repaired.load(scope('current-null'))?.nextAttemptAt).toBe(
      repaired.load(scope('current-null'))?.acceptedAt,
    );
    expect(repaired.claimDueRetries(now).map(record => record.scope.requestId)).toContain(
      'current-null',
    );
    repaired.close();
  });

  it('upgrades deployed version-three envelopes with explicit legacy key metadata', () => {
    const file = databasePath();
    createVersionThree(file);

    const store = RelayStore.open(file);

    expect(store.schemaVersion()).toBe(4);
    expect(store.load(scope('migrated-v2'))?.envelope).toMatchObject({
      formatVersion: 1,
      keyId: 'legacy',
    });
    store.close();
  });

  it.each(['version-one', 'version-two'] as const)(
    'preserves the version-three retry deadline constraint after migrating %s',
    version => {
      const file = databasePath();
      if (version === 'version-one') createVersionOne(file);
      else createVersionTwo(file);

      RelayStore.open(file).close();

      const database = new Database(file, { readonly: true });
      const deadline = database
        .prepare<[], { name: string; notnull: number }>('PRAGMA table_info(retro_requests)')
        .all()
        .find(column => column.name === 'retry_deadline_at');
      expect(deadline?.notnull).toBe(1);
      expect(
        database
          .prepare<[string], { count: number }>(
            'SELECT COUNT(*) AS count FROM reconciliation_audit WHERE receipt_id = ?',
          )
          .get('receipt-v1')?.count,
      ).toBe(1);
      expect(
        database
          .prepare<[string], { count: number }>(
            'SELECT COUNT(*) AS count FROM alert_outbox WHERE receipt_id = ?',
          )
          .get('receipt-v1')?.count,
      ).toBe(version === 'version-one' ? 0 : 1);
      expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      database.close();
    },
  );
});

describe('durable retry and terminal lifecycle', () => {
  it('[ORR-025] persists due scheduling and exponential backoff across restart', () => {
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

  it('does not let an inbound retry bypass its durable next-attempt schedule', () => {
    const file = databasePath();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const store = RelayStore.open(file, { now: () => now });
    accept(store, 'scheduled');
    expect(store.claim(scope('scheduled'), now)).toBe(true);
    store.markRetryable(scope('scheduled'), now);

    expect(store.load(scope('scheduled'))?.nextAttemptAt).toBe('2026-01-01T00:01:00.000Z');
    expect(store.claim(scope('scheduled'), new Date('2026-01-01T00:00:30.000Z'))).toBe(false);
    expect(store.claim(scope('scheduled'), new Date('2026-01-01T00:01:00.000Z'))).toBe(true);
    store.close();
  });

  it('never schedules a retry before an upstream rate-limit deadline', () => {
    const file = databasePath();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const store = RelayStore.open(file, { now: () => now });
    accept(store, 'rate-limited');
    expect(store.claim(scope('rate-limited'), now)).toBe(true);

    store.markRetryable(scope('rate-limited'), now, new Date('2026-01-01T00:10:00.000Z'));

    expect(store.load(scope('rate-limited'))?.nextAttemptAt).toBe('2026-01-01T00:10:00.000Z');
    store.close();
  });

  it('[ORR-024] [ORR-026] prevents a new dispatch at 24 hours and dead-letters exactly once', () => {
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

  it('uses the caller deadline across delayed acceptance and caps attempted extensions', () => {
    const file = databasePath();
    const acceptedAt = new Date('2026-01-01T23:59:00.000Z');
    const store = RelayStore.open(file, { now: () => acceptedAt });
    const sharedDeadline = '2026-01-02T00:00:00.000Z';
    store.accept({
      envelope: {
        ciphertext: Buffer.from('shared-deadline'),
        formatVersion: 2,
        keyId: 'test',
        nonce: Buffer.alloc(12, 1),
        tag: Buffer.alloc(16, 2),
      },
      payloadHash: 'shared-deadline',
      requestMarker: '<!-- request:shared-deadline -->',
      retryDeadlineAt: sharedDeadline,
      scope: scope('shared-deadline'),
    });
    accept(store, 'capped-extension');

    expect(store.load(scope('shared-deadline'))?.retryDeadlineAt).toBe(sharedDeadline);
    expect(store.load(scope('capped-extension'))?.retryDeadlineAt).toBe('2026-01-02T23:59:00.000Z');
    expect(store.claim(scope('shared-deadline'), new Date(sharedDeadline))).toBe(false);
    store.maintain(new Date(sharedDeadline));
    expect(store.receipt(scope('shared-deadline'))?.state).toBe('dead-letter');
    store.close();
  });

  it('[ORR-024] [ORR-027] allows exactly one filed or ambiguous winner at the 25-hour CAS boundary', () => {
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

  it('[ORR-024] compacts payload access at 30 days while retaining non-reusable identity', () => {
    const file = databasePath();
    const acceptedAt = new Date('2026-01-01T00:00:00.000Z');
    let store = RelayStore.open(file, { now: () => acceptedAt });
    accept(store, 'retained');
    store.claim(scope('retained'), acceptedAt);
    store.beginDispatch(scope('retained'), acceptedAt);
    store.markFiled(scope('retained'), 1479, acceptedAt);
    store.maintain(new Date('2026-01-31T00:00:00.000Z'));
    store.checkpoint();
    store.close();

    store = RelayStore.open(file);
    const record = store.load(scope('retained'));
    expect(record?.state).toBe('tombstone');
    expect(record?.envelope.ciphertext).toHaveLength(0);
    expect(record?.scope.requestId).toBe('retained');
    expect(record?.issueNumber).toBe(1479);
    store.close();
  });

  it('compacts rejected payloads after 30 days so retired keys do not brick startup', () => {
    const file = databasePath();
    const acceptedAt = new Date('2026-01-01T00:00:00.000Z');
    const store = RelayStore.open(file, { now: () => acceptedAt });
    accept(store, 'rejected-retained');
    store.claim(scope('rejected-retained'), acceptedAt);
    store.beginDispatch(scope('rejected-retained'), acceptedAt);
    store.markRejected(scope('rejected-retained'), acceptedAt);

    store.maintain(new Date('2026-01-31T00:00:00.000Z'));

    expect(store.load(scope('rejected-retained'))).toMatchObject({
      envelope: { ciphertext: Buffer.alloc(0) },
      state: 'tombstone',
    });
    expect(store.payloadKeyIds()).toEqual([]);
    store.close();
  });

  it('[ORR-033] reports lifecycle counts and stable deduplicable alert event IDs', () => {
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

  it('[ORR-034] atomically records an alert when a request becomes immediately ambiguous', () => {
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
