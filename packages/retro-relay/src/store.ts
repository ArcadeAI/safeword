import { createHash, randomBytes } from 'node:crypto';

import type { PayloadEnvelope } from './payload.js';
import Database from './sqlite.js';
import type { FilingReceipt, ReceiptState, RelayPrincipal, RequestScope } from './types.js';

type StoredState =
  'accepted' | 'claimed' | 'dispatching' | 'filed' | 'ambiguous' | 'rejected' | 'retryable';

interface RequestRow {
  accepted_at: string;
  attempt_count: number;
  dead_lettered_at: string | null;
  dispatch_started_at: string | null;
  filed_at: string | null;
  installation_id: number;
  issue_number: number | null;
  next_attempt_at: string | null;
  payload_ciphertext: Buffer;
  payload_compacted_at: string | null;
  payload_format_version: 1 | 2;
  payload_hash: string;
  payload_key_id: string;
  payload_nonce: Buffer;
  payload_tag: Buffer;
  receipt_id: string;
  repository: string;
  request_id: string;
  request_marker: string;
  retry_deadline_at: string;
  state: StoredState;
  tenant_id: string;
  tombstoned_at: string | null;
}

export interface DurableRequest {
  acceptedAt: string;
  attemptCount: number;
  dispatchStartedAt?: string;
  envelope: PayloadEnvelope;
  issueNumber?: number;
  nextAttemptAt?: string;
  payloadHash: string;
  receiptId: string;
  requestMarker: string;
  retryDeadlineAt: string;
  scope: RequestScope;
  state: ReceiptState;
}

export interface AcceptInput {
  acceptedAt?: string;
  envelope: PayloadEnvelope;
  payloadHash: string;
  requestMarker: string;
  retryDeadlineAt: string;
  scope: RequestScope;
}

export interface MaintenanceAlert {
  eventId: string;
  receiptId: string;
  state: 'ambiguous' | 'dead-letter';
}

type MigrationFault = (step: 'after-columns' | 'after-outbox' | 'before-version') => void;
type ScopeRow = Pick<RequestRow, 'tenant_id' | 'installation_id' | 'repository' | 'request_id'>;

const CURRENT_SCHEMA_VERSION = 4;
const V1_COLUMNS = [
  'tenant_id',
  'installation_id',
  'repository',
  'request_id',
  'receipt_id',
  'payload_hash',
  'payload_nonce',
  'payload_ciphertext',
  'payload_tag',
  'state',
  'issue_number',
  'request_marker',
  'accepted_at',
  'filed_at',
] as const;

const V2_EXTRA_COLUMNS = [
  'dead_lettered_at',
  'tombstoned_at',
  'payload_compacted_at',
  'next_attempt_at',
  'attempt_count',
  'dispatch_started_at',
] as const;
const V3_EXTRA_COLUMNS = ['retry_deadline_at'] as const;
const V4_EXTRA_COLUMNS = ['payload_format_version', 'payload_key_id'] as const;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function projectedState(row: RequestRow): ReceiptState {
  if (row.tombstoned_at !== null) return 'tombstone';
  if (row.dead_lettered_at !== null) return 'dead-letter';
  return row.state;
}

function rowToRequest(row: RequestRow): DurableRequest {
  return {
    acceptedAt: row.accepted_at,
    attemptCount: row.attempt_count,
    envelope: {
      ciphertext: row.payload_ciphertext,
      formatVersion: row.payload_format_version,
      keyId: row.payload_key_id,
      nonce: row.payload_nonce,
      tag: row.payload_tag,
    },
    nextAttemptAt: row.next_attempt_at ?? undefined,
    payloadHash: row.payload_hash,
    receiptId: row.receipt_id,
    requestMarker: row.request_marker,
    retryDeadlineAt: row.retry_deadline_at,
    scope: {
      installationId: row.installation_id,
      repository: row.repository,
      requestId: row.request_id,
      tenantId: row.tenant_id,
    },
    state: projectedState(row),
    ...(row.dispatch_started_at !== null && { dispatchStartedAt: row.dispatch_started_at }),
    ...(row.issue_number !== null && { issueNumber: row.issue_number }),
  };
}

export function filingReceipt(record: DurableRequest): FilingReceipt {
  return {
    receiptId: record.receiptId,
    requestId: record.scope.requestId,
    state: record.state,
    ...(record.issueNumber !== undefined && { issueNumber: record.issueNumber }),
  };
}

function tableExists(database: Database, table: string): boolean {
  return (
    database
      .prepare<[string], { present: number }>(
        `SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?`,
      )
      .get(table)?.present === 1
  );
}

function tableInfo(database: Database, table: string): { name: string; notnull: number }[] {
  return database
    .prepare<[], { name: string; notnull: number }>(`PRAGMA table_info(${table})`)
    .all();
}

function columns(database: Database, table: string): string[] {
  return tableInfo(database, table).map(column => column.name);
}

function exactColumns(actual: string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && expected.every(column => actual.includes(column));
}

type RetroRequestsTable = 'retro_requests' | 'retro_requests_v3' | 'retro_requests_v4';

function retroRequestsTable(table: RetroRequestsTable): string {
  return `
    CREATE TABLE ${table} (
      tenant_id TEXT NOT NULL,
      installation_id INTEGER NOT NULL,
      repository TEXT NOT NULL,
      request_id TEXT NOT NULL,
      receipt_id TEXT NOT NULL UNIQUE,
      payload_hash TEXT NOT NULL,
      payload_format_version INTEGER NOT NULL CHECK (payload_format_version IN (1, 2)),
      payload_key_id TEXT NOT NULL,
      payload_nonce BLOB NOT NULL,
      payload_ciphertext BLOB NOT NULL,
      payload_tag BLOB NOT NULL,
      state TEXT NOT NULL CHECK (state IN (
        'accepted', 'claimed', 'dispatching', 'filed', 'ambiguous', 'rejected', 'retryable'
      )),
      issue_number INTEGER,
      request_marker TEXT NOT NULL,
      accepted_at TEXT NOT NULL,
      retry_deadline_at TEXT NOT NULL,
      filed_at TEXT,
      dead_lettered_at TEXT,
      tombstoned_at TEXT,
      payload_compacted_at TEXT,
      next_attempt_at TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      dispatch_started_at TEXT,
      PRIMARY KEY (tenant_id, installation_id, repository, request_id)
    ) STRICT;
  `;
}

function reconciliationAuditTable(
  table: 'reconciliation_audit' | 'reconciliation_audit_v3' | 'reconciliation_audit_v4',
  requestsTable: 'retro_requests' | 'retro_requests_v3' | 'retro_requests_v4',
): string {
  return `
    CREATE TABLE ${table} (
      audit_id INTEGER PRIMARY KEY,
      receipt_id TEXT NOT NULL,
      actor_subject TEXT NOT NULL,
      disposition TEXT NOT NULL,
      match_count INTEGER NOT NULL,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (receipt_id) REFERENCES ${requestsTable} (receipt_id)
    ) STRICT;
  `;
}

function alertOutboxTable(
  table: 'alert_outbox' | 'alert_outbox_v3' | 'alert_outbox_v4',
  requestsTable: 'retro_requests' | 'retro_requests_v3' | 'retro_requests_v4',
): string {
  return `
    CREATE TABLE ${table} (
      event_id TEXT PRIMARY KEY,
      receipt_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('ambiguous', 'dead-letter')),
      created_at TEXT NOT NULL,
      delivered_at TEXT,
      FOREIGN KEY (receipt_id) REFERENCES ${requestsTable} (receipt_id)
    ) STRICT;
  `;
}

function createCurrentVersion(database: Database): void {
  database.exec(`
    CREATE TABLE schema_version (version INTEGER NOT NULL) STRICT;
    INSERT INTO schema_version VALUES (${CURRENT_SCHEMA_VERSION});

    ${retroRequestsTable('retro_requests')}
    ${reconciliationAuditTable('reconciliation_audit', 'retro_requests')}
    ${alertOutboxTable('alert_outbox', 'retro_requests')}
  `);
}

function readSchemaVersion(database: Database): number {
  if (!tableExists(database, 'schema_version')) throw new Error('schema version table is missing');
  const rows = database
    .prepare<[], { version: number }>('SELECT version FROM schema_version')
    .all();
  if (rows.length !== 1) throw new Error('schema version must contain exactly one row');
  const version = rows[0]?.version;
  if (!Number.isSafeInteger(version)) throw new Error('schema version is invalid');
  return version;
}

function validateCurrentVersion(database: Database): void {
  const expected = [...V1_COLUMNS, ...V2_EXTRA_COLUMNS, ...V3_EXTRA_COLUMNS, ...V4_EXTRA_COLUMNS];
  const requestColumns = tableInfo(database, 'retro_requests');
  if (
    !exactColumns(
      requestColumns.map(column => column.name),
      expected,
    )
  ) {
    throw new Error('schema version four layout is partial or incompatible');
  }
  const deadline = requestColumns.find(column => column.name === 'retry_deadline_at');
  if (deadline?.notnull !== 1) {
    throw new Error('schema version four retry deadline constraint is missing');
  }
  for (const name of V4_EXTRA_COLUMNS) {
    if (requestColumns.find(column => column.name === name)?.notnull !== 1) {
      throw new Error(`schema version four ${name} constraint is missing`);
    }
  }
  for (const table of ['reconciliation_audit', 'alert_outbox']) {
    if (!tableExists(database, table)) throw new Error(`schema table ${table} is missing`);
  }
}

function migrateVersionOne(database: Database, fault?: MigrationFault): void {
  if (!exactColumns(columns(database, 'retro_requests'), V1_COLUMNS)) {
    throw new Error('schema version one layout is partial or incompatible');
  }
  database.immediateTransaction(() => {
    database.exec(`
      PRAGMA defer_foreign_keys = ON;
      ${retroRequestsTable('retro_requests_v3')}
      INSERT INTO retro_requests_v3 (
        tenant_id, installation_id, repository, request_id, receipt_id,
        payload_hash, payload_format_version, payload_key_id,
        payload_nonce, payload_ciphertext, payload_tag, state,
        issue_number, request_marker, accepted_at, retry_deadline_at, filed_at,
        next_attempt_at, attempt_count
      )
      SELECT
        tenant_id, installation_id, repository, request_id, receipt_id,
        payload_hash, 1, 'legacy', payload_nonce, payload_ciphertext, payload_tag, state,
        issue_number, request_marker, accepted_at,
        strftime('%Y-%m-%dT%H:%M:%fZ', accepted_at, '+24 hours'), filed_at,
        accepted_at, 0
      FROM retro_requests;
      ${reconciliationAuditTable('reconciliation_audit_v3', 'retro_requests_v3')}
      INSERT INTO reconciliation_audit_v3
      SELECT * FROM reconciliation_audit;
      DROP TABLE reconciliation_audit;
      DROP TABLE retro_requests;
      ALTER TABLE retro_requests_v3 RENAME TO retro_requests;
      ALTER TABLE reconciliation_audit_v3 RENAME TO reconciliation_audit;
    `);
    fault?.('after-columns');
    database.exec(`
      ${alertOutboxTable('alert_outbox', 'retro_requests')}
    `);
    fault?.('after-outbox');
    fault?.('before-version');
    database.exec(`UPDATE schema_version SET version = ${CURRENT_SCHEMA_VERSION};`);
  });
}

function migrateVersionTwo(database: Database): void {
  if (!exactColumns(columns(database, 'retro_requests'), [...V1_COLUMNS, ...V2_EXTRA_COLUMNS])) {
    throw new Error('schema version two layout is partial or incompatible');
  }
  database.immediateTransaction(() => {
    database.exec(`
      PRAGMA defer_foreign_keys = ON;
      ${retroRequestsTable('retro_requests_v3')}
      INSERT INTO retro_requests_v3 (
        tenant_id, installation_id, repository, request_id, receipt_id,
        payload_hash, payload_format_version, payload_key_id,
        payload_nonce, payload_ciphertext, payload_tag, state,
        issue_number, request_marker, accepted_at, retry_deadline_at, filed_at,
        dead_lettered_at, tombstoned_at, payload_compacted_at, next_attempt_at,
        attempt_count, dispatch_started_at
      )
      SELECT
        tenant_id, installation_id, repository, request_id, receipt_id,
        payload_hash, 1, 'legacy', payload_nonce, payload_ciphertext, payload_tag, state,
        issue_number, request_marker, accepted_at,
        strftime('%Y-%m-%dT%H:%M:%fZ', accepted_at, '+24 hours'), filed_at,
        dead_lettered_at, tombstoned_at, payload_compacted_at,
        COALESCE(next_attempt_at, accepted_at),
        attempt_count, dispatch_started_at
      FROM retro_requests;
      ${reconciliationAuditTable('reconciliation_audit_v3', 'retro_requests_v3')}
      INSERT INTO reconciliation_audit_v3
      SELECT * FROM reconciliation_audit;
      ${alertOutboxTable('alert_outbox_v3', 'retro_requests_v3')}
      INSERT INTO alert_outbox_v3
      SELECT * FROM alert_outbox;
      DROP TABLE alert_outbox;
      DROP TABLE reconciliation_audit;
      DROP TABLE retro_requests;
      ALTER TABLE retro_requests_v3 RENAME TO retro_requests;
      ALTER TABLE reconciliation_audit_v3 RENAME TO reconciliation_audit;
      ALTER TABLE alert_outbox_v3 RENAME TO alert_outbox;
      UPDATE schema_version SET version = ${CURRENT_SCHEMA_VERSION};
    `);
  });
}

function migrateVersionThree(database: Database): void {
  const expected = [...V1_COLUMNS, ...V2_EXTRA_COLUMNS, ...V3_EXTRA_COLUMNS];
  if (!exactColumns(columns(database, 'retro_requests'), expected)) {
    throw new Error('schema version three layout is partial or incompatible');
  }
  database.immediateTransaction(() => {
    database.exec(`
      PRAGMA defer_foreign_keys = ON;
      ${retroRequestsTable('retro_requests_v4')}
      INSERT INTO retro_requests_v4 (
        tenant_id, installation_id, repository, request_id, receipt_id,
        payload_hash, payload_format_version, payload_key_id,
        payload_nonce, payload_ciphertext, payload_tag, state,
        issue_number, request_marker, accepted_at, retry_deadline_at, filed_at,
        dead_lettered_at, tombstoned_at, payload_compacted_at, next_attempt_at,
        attempt_count, dispatch_started_at
      )
      SELECT
        tenant_id, installation_id, repository, request_id, receipt_id,
        payload_hash, 1, 'legacy', payload_nonce, payload_ciphertext, payload_tag, state,
        issue_number, request_marker, accepted_at, retry_deadline_at, filed_at,
        dead_lettered_at, tombstoned_at, payload_compacted_at,
        COALESCE(next_attempt_at, accepted_at),
        attempt_count, dispatch_started_at
      FROM retro_requests;
      ${reconciliationAuditTable('reconciliation_audit_v4', 'retro_requests_v4')}
      INSERT INTO reconciliation_audit_v4 SELECT * FROM reconciliation_audit;
      ${alertOutboxTable('alert_outbox_v4', 'retro_requests_v4')}
      INSERT INTO alert_outbox_v4 SELECT * FROM alert_outbox;
      DROP TABLE alert_outbox;
      DROP TABLE reconciliation_audit;
      DROP TABLE retro_requests;
      ALTER TABLE retro_requests_v4 RENAME TO retro_requests;
      ALTER TABLE reconciliation_audit_v4 RENAME TO reconciliation_audit;
      ALTER TABLE alert_outbox_v4 RENAME TO alert_outbox;
      UPDATE schema_version SET version = ${CURRENT_SCHEMA_VERSION};
    `);
  });
}

function prepareDatabase(
  database: Database,
  fault?: (step: 'after-columns' | 'after-outbox' | 'before-version') => void,
): void {
  if (!tableExists(database, 'schema_version')) {
    createCurrentVersion(database);
    return;
  }
  const version = readSchemaVersion(database);
  switch (version) {
    case 1: {
      migrateVersionOne(database, fault);
      break;
    }
    case 2: {
      migrateVersionTwo(database);
      break;
    }
    case 3: {
      migrateVersionThree(database);
      break;
    }
    case CURRENT_SCHEMA_VERSION: {
      validateCurrentVersion(database);
      database.exec(
        'UPDATE retro_requests SET next_attempt_at = accepted_at WHERE next_attempt_at IS NULL;',
      );
      break;
    }
    default: {
      throw new Error(`schema version ${version} is newer than this relay`);
    }
  }
}

function alertId(receiptId: string, state: string): string {
  return createHash('sha256').update(`${receiptId}:${state}`).digest('hex');
}

export class RelayStore {
  static open(
    databasePath: string,
    options: {
      migrationFault?: MigrationFault;
      now?: () => Date;
    } = {},
  ): RelayStore {
    const database = new Database(databasePath, { timeout: 5000 });
    try {
      database.pragma('journal_mode = WAL');
      database.pragma('synchronous = FULL');
      database.pragma('foreign_keys = ON');
      prepareDatabase(database, options.migrationFault);
      validateCurrentVersion(database);
      return new RelayStore(database, options.now ?? (() => new Date()));
    } catch (error) {
      database.close();
      throw error;
    }
  }

  readonly #database: Database;
  readonly #now: () => Date;

  private constructor(database: Database, now: () => Date) {
    this.#database = database;
    this.#now = now;
  }

  accept(input: AcceptInput): { inserted: boolean; record: DurableRequest } {
    const relayAcceptedAt = this.#now();
    const acceptedAt = input.acceptedAt ?? relayAcceptedAt.toISOString();
    const suppliedDeadline = new Date(input.retryDeadlineAt);
    const maximumDeadline = new Date(relayAcceptedAt.getTime() + DAY_MS);
    const retryDeadlineAt = new Date(
      Math.min(suppliedDeadline.getTime(), maximumDeadline.getTime()),
    ).toISOString();
    const receiptId = randomBytes(32).toString('base64url');
    const result = this.#database
      .prepare(
        `INSERT INTO retro_requests (
          tenant_id, installation_id, repository, request_id, receipt_id,
          payload_hash, payload_format_version, payload_key_id,
          payload_nonce, payload_ciphertext, payload_tag,
          state, issue_number, request_marker, accepted_at, retry_deadline_at, next_attempt_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted', NULL, ?, ?, ?, ?)
        ON CONFLICT (tenant_id, installation_id, repository, request_id) DO NOTHING`,
      )
      .run(
        input.scope.tenantId,
        input.scope.installationId,
        input.scope.repository,
        input.scope.requestId,
        receiptId,
        input.payloadHash,
        input.envelope.formatVersion,
        input.envelope.keyId,
        input.envelope.nonce,
        input.envelope.ciphertext,
        input.envelope.tag,
        input.requestMarker,
        acceptedAt,
        retryDeadlineAt,
        acceptedAt,
      );
    const record = this.load(input.scope);
    if (record === undefined) throw new Error('accepted request disappeared');
    return { inserted: result.changes === 1, record };
  }

  claim(scope: RequestScope, now = this.#now()): boolean {
    return (
      this.#database
        .prepare(
          `UPDATE retro_requests
           SET state = 'claimed', attempt_count = attempt_count + 1
           WHERE tenant_id = ? AND installation_id = ? AND repository = ?
             AND request_id = ? AND state IN ('accepted', 'retryable')
             AND dead_lettered_at IS NULL
             AND next_attempt_at <= ?
             AND julianday(?) < julianday(retry_deadline_at)`,
        )
        .run(
          scope.tenantId,
          scope.installationId,
          scope.repository,
          scope.requestId,
          now.toISOString(),
          now.toISOString(),
        ).changes === 1
    );
  }

  claimDueRetries(now = this.#now(), limit = 100): DurableRequest[] {
    const candidates = this.#database
      .prepare<[string, string, number], ScopeRow>(
        `SELECT tenant_id, installation_id, repository, request_id
         FROM retro_requests
         WHERE state IN ('accepted', 'retryable') AND dead_lettered_at IS NULL
           AND next_attempt_at <= ?
           AND julianday(?) < julianday(retry_deadline_at)
         ORDER BY next_attempt_at, accepted_at LIMIT ?`,
      )
      .all(now.toISOString(), now.toISOString(), limit);
    const claimed: DurableRequest[] = [];
    for (const row of candidates) {
      const candidateScope = {
        installationId: row.installation_id,
        repository: row.repository,
        requestId: row.request_id,
        tenantId: row.tenant_id,
      };
      if (!this.claim(candidateScope, now)) continue;
      const record = this.load(candidateScope);
      if (record !== undefined) claimed.push(record);
    }
    return claimed;
  }

  beginDispatch(scope: RequestScope, now = this.#now()): boolean {
    return (
      this.#database
        .prepare(
          `UPDATE retro_requests SET state = 'dispatching', dispatch_started_at = ?
           WHERE tenant_id = ? AND installation_id = ? AND repository = ?
             AND request_id = ? AND state = 'claimed' AND dead_lettered_at IS NULL
             AND julianday(?) < julianday(retry_deadline_at)`,
        )
        .run(
          now.toISOString(),
          scope.tenantId,
          scope.installationId,
          scope.repository,
          scope.requestId,
          now.toISOString(),
        ).changes === 1
    );
  }

  beginManualRecovery(scope: RequestScope, now = this.#now()): boolean {
    return (
      this.#database
        .prepare(
          `UPDATE retro_requests SET state = 'dispatching', dispatch_started_at = ?
           WHERE tenant_id = ? AND installation_id = ? AND repository = ?
             AND request_id = ? AND tombstoned_at IS NULL
             AND (
               (state = 'ambiguous' AND dead_lettered_at IS NULL)
               OR (state != 'dispatching' AND dead_lettered_at IS NOT NULL)
             )`,
        )
        .run(
          now.toISOString(),
          scope.tenantId,
          scope.installationId,
          scope.repository,
          scope.requestId,
        ).changes === 1
    );
  }

  cancelManualRecovery(scope: RequestScope): void {
    this.#database
      .prepare(
        `UPDATE retro_requests
         SET state = CASE WHEN dead_lettered_at IS NULL THEN 'ambiguous' ELSE 'retryable' END
         WHERE tenant_id = ? AND installation_id = ? AND repository = ?
           AND request_id = ? AND state = 'dispatching'
           AND tombstoned_at IS NULL`,
      )
      .run(scope.tenantId, scope.installationId, scope.repository, scope.requestId);
  }

  close(): void {
    this.#database.close();
  }

  checkpoint(): void {
    this.#database.pragma('wal_checkpoint(TRUNCATE)');
  }

  journalMode(): string {
    return this.#database.pragma('journal_mode', { simple: true }) as string;
  }

  load(scope: RequestScope): DurableRequest | undefined {
    const row = this.#database
      .prepare<[string, number, string, string], RequestRow>(
        `SELECT * FROM retro_requests
         WHERE tenant_id = ? AND installation_id = ? AND repository = ? AND request_id = ?`,
      )
      .get(scope.tenantId, scope.installationId, scope.repository, scope.requestId);
    return row === undefined ? undefined : rowToRequest(row);
  }

  loadByReceiptForPrincipal(
    receiptId: string,
    principal: Pick<RelayPrincipal, 'installationId' | 'repository' | 'tenantId'>,
  ): DurableRequest | undefined {
    const row = this.#database
      .prepare<[string, string, number, string], RequestRow>(
        `SELECT * FROM retro_requests
         WHERE receipt_id = ? AND tenant_id = ? AND installation_id = ? AND repository = ?`,
      )
      .get(receiptId, principal.tenantId, principal.installationId, principal.repository);
    return row === undefined ? undefined : rowToRequest(row);
  }

  markAmbiguous(scope: RequestScope, now = this.#now()): void {
    this.#database.immediateTransaction(() => {
      const row = this.#database
        .prepare<[string, number, string, string], Pick<RequestRow, 'receipt_id'>>(
          `UPDATE retro_requests SET state = 'ambiguous'
           WHERE tenant_id = ? AND installation_id = ? AND repository = ?
             AND request_id = ? AND state IN ('claimed', 'dispatching', 'retryable')
             AND dead_lettered_at IS NULL
           RETURNING receipt_id`,
        )
        .get(scope.tenantId, scope.installationId, scope.repository, scope.requestId);
      if (row !== undefined) this.#insertAlert(row.receipt_id, 'ambiguous', now);
    });
  }

  markFiled(scope: RequestScope, issueNumber: number, now = this.#now()): FilingReceipt {
    const result = this.#database
      .prepare(
        `UPDATE retro_requests SET state = 'filed', issue_number = ?, filed_at = ?
         WHERE tenant_id = ? AND installation_id = ? AND repository = ? AND request_id = ?
           AND dead_lettered_at IS NULL AND tombstoned_at IS NULL
           AND (
             (state = 'claimed' AND julianday(?) < julianday(retry_deadline_at))
             OR
             (state = 'dispatching' AND julianday(?) < julianday(retry_deadline_at, '+1 hour'))
           )`,
      )
      .run(
        issueNumber,
        now.toISOString(),
        scope.tenantId,
        scope.installationId,
        scope.repository,
        scope.requestId,
        now.toISOString(),
        now.toISOString(),
      );
    if (result.changes !== 1) throw new Error('filing transition lost');
    const record = this.load(scope);
    if (record === undefined) throw new Error('filed request disappeared');
    return filingReceipt(record);
  }

  markReconciledFiled(scope: RequestScope, issueNumber: number, now = this.#now()): FilingReceipt {
    const result = this.#database
      .prepare(
        `UPDATE retro_requests
         SET state = 'filed', issue_number = ?, filed_at = ?, dead_lettered_at = NULL
         WHERE tenant_id = ? AND installation_id = ? AND repository = ? AND request_id = ?
           AND state IN ('ambiguous', 'dispatching') AND tombstoned_at IS NULL`,
      )
      .run(
        issueNumber,
        now.toISOString(),
        scope.tenantId,
        scope.installationId,
        scope.repository,
        scope.requestId,
      );
    if (result.changes !== 1) throw new Error('reconciliation transition lost');
    const record = this.load(scope);
    if (record === undefined) throw new Error('filed request disappeared');
    return filingReceipt(record);
  }

  markRejected(scope: RequestScope, now = this.#now()): FilingReceipt {
    const result = this.#database
      .prepare(
        `UPDATE retro_requests SET state = 'rejected', filed_at = ?
         WHERE tenant_id = ? AND installation_id = ? AND repository = ? AND request_id = ?
           AND state = 'dispatching' AND dead_lettered_at IS NULL`,
      )
      .run(
        now.toISOString(),
        scope.tenantId,
        scope.installationId,
        scope.repository,
        scope.requestId,
      );
    if (result.changes !== 1) throw new Error('rejection transition lost');
    const record = this.load(scope);
    if (record === undefined) throw new Error('rejected request disappeared');
    return filingReceipt(record);
  }

  markRetryable(scope: RequestScope, now = this.#now(), notBefore?: Date): void {
    const record = this.load(scope);
    if (record === undefined) return;
    const deadline = new Date(record.retryDeadlineAt);
    const backoff = Math.min(2 ** Math.max(record.attemptCount - 1, 0) * 60_000, HOUR_MS);
    const regularRetryAt = now.getTime() + backoff;
    const upstreamRetryAt = notBefore?.getTime() ?? -Infinity;
    const boundedRetryAt = Math.min(Math.max(regularRetryAt, upstreamRetryAt), deadline.getTime());
    const nextAttempt = new Date(boundedRetryAt);
    this.#database
      .prepare(
        `UPDATE retro_requests SET state = 'retryable', next_attempt_at = ?
         WHERE tenant_id = ? AND installation_id = ? AND repository = ?
           AND request_id = ? AND state IN ('claimed', 'dispatching')
           AND dead_lettered_at IS NULL`,
      )
      .run(
        nextAttempt.toISOString(),
        scope.tenantId,
        scope.installationId,
        scope.repository,
        scope.requestId,
      );
  }

  receipt(scope: RequestScope): FilingReceipt | undefined {
    const record = this.load(scope);
    return record === undefined ? undefined : filingReceipt(record);
  }

  recordReconciliation(
    receiptId: string,
    actorSubject: string,
    disposition:
      | 'adopted'
      | 'conflict'
      | 'incomplete'
      | 'manual-create-attempted'
      | 'manual-created'
      | 'multiple'
      | 'zero',
    matchCount: number,
  ): void {
    this.#database
      .prepare(
        `INSERT INTO reconciliation_audit (
          receipt_id, actor_subject, disposition, match_count, recorded_at
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(receiptId, actorSubject, disposition, matchCount, this.#now().toISOString());
  }

  reconciliationAudit(receiptId: string): {
    actorSubject: string;
    disposition: string;
    matchCount: number;
  }[] {
    return this.#database
      .prepare<[string], { actor_subject: string; disposition: string; match_count: number }>(
        `SELECT actor_subject, disposition, match_count
         FROM reconciliation_audit WHERE receipt_id = ? ORDER BY audit_id`,
      )
      .all(receiptId)
      .map(row => ({
        actorSubject: row.actor_subject,
        disposition: row.disposition,
        matchCount: row.match_count,
      }));
  }

  schemaVersion(): number {
    return readSchemaVersion(this.#database);
  }

  payloadKeyIds(): string[] {
    return this.#database
      .prepare<[], { payload_key_id: string }>(
        `SELECT DISTINCT payload_key_id FROM retro_requests
         WHERE payload_compacted_at IS NULL
         ORDER BY payload_key_id`,
      )
      .all()
      .map(row => row.payload_key_id);
  }

  recoverInFlight(): void {
    const now = this.#now().toISOString();
    this.#database.immediateTransaction(() => {
      this.#database
        .prepare(
          `UPDATE retro_requests SET state = 'retryable', next_attempt_at = ?
           WHERE state = 'claimed' AND dead_lettered_at IS NULL`,
        )
        .run(now);
      const ambiguous = this.#database
        .prepare<[], Pick<RequestRow, 'receipt_id'>>(
          `UPDATE retro_requests SET state = 'ambiguous'
           WHERE state = 'dispatching' AND dead_lettered_at IS NULL
           RETURNING receipt_id`,
        )
        .all();
      for (const row of ambiguous) {
        this.#insertAlert(row.receipt_id, 'ambiguous', new Date(now));
      }
      this.#database
        .prepare(
          `UPDATE retro_requests SET state = 'retryable', next_attempt_at = ?
           WHERE state = 'dispatching' AND dead_lettered_at IS NOT NULL`,
        )
        .run(now);
    });
  }

  maintain(now = this.#now()): { alerts: MaintenanceAlert[] } {
    return this.#database.immediateTransaction(() => {
      const alerts: MaintenanceAlert[] = [];
      const deadLetters = this.#database
        .prepare<[string], Pick<RequestRow, 'receipt_id'>>(
          `SELECT receipt_id FROM retro_requests
           WHERE state IN ('accepted', 'retryable', 'claimed')
             AND dead_lettered_at IS NULL
             AND julianday(?) >= julianday(retry_deadline_at)`,
        )
        .all(now.toISOString());
      for (const item of deadLetters) {
        const result = this.#database
          .prepare(
            `UPDATE retro_requests SET dead_lettered_at = ?
             WHERE receipt_id = ? AND state IN ('accepted', 'retryable', 'claimed')
               AND dead_lettered_at IS NULL
               AND julianday(?) >= julianday(retry_deadline_at)`,
          )
          .run(now.toISOString(), item.receipt_id, now.toISOString());
        if (result.changes === 1) {
          const alert = this.#insertAlert(item.receipt_id, 'dead-letter', now);
          if (alert !== undefined) alerts.push(alert);
        }
      }

      const ambiguous = this.#database
        .prepare<[string], Pick<RequestRow, 'receipt_id'>>(
          `SELECT receipt_id FROM retro_requests
           WHERE state = 'dispatching' AND dead_lettered_at IS NULL
             AND julianday(?) >= julianday(retry_deadline_at, '+1 hour')`,
        )
        .all(now.toISOString());
      for (const item of ambiguous) {
        const result = this.#database
          .prepare(
            `UPDATE retro_requests SET state = 'ambiguous'
             WHERE receipt_id = ? AND state = 'dispatching'
               AND julianday(?) >= julianday(retry_deadline_at, '+1 hour')`,
          )
          .run(item.receipt_id, now.toISOString());
        if (result.changes === 1) {
          const alert = this.#insertAlert(item.receipt_id, 'ambiguous', now);
          if (alert !== undefined) alerts.push(alert);
        }
      }

      this.#database
        .prepare(
          `UPDATE retro_requests
           SET tombstoned_at = ?, payload_compacted_at = ?,
               payload_nonce = zeroblob(0), payload_ciphertext = zeroblob(0),
               payload_tag = zeroblob(0)
           WHERE state IN ('filed', 'rejected') AND tombstoned_at IS NULL
             AND julianday(?) >= julianday(filed_at, '+30 days')`,
        )
        .run(now.toISOString(), now.toISOString(), now.toISOString());
      return { alerts };
    });
  }

  // eslint-disable-next-line unicorn/consistent-class-member-order -- Kept next to the maintenance transaction that calls it.
  #insertAlert(
    receiptId: string,
    state: MaintenanceAlert['state'],
    now: Date,
  ): MaintenanceAlert | undefined {
    const eventId = alertId(receiptId, state);
    const result = this.#database
      .prepare(
        `INSERT INTO alert_outbox (event_id, receipt_id, state, created_at)
         VALUES (?, ?, ?, ?) ON CONFLICT (event_id) DO NOTHING`,
      )
      .run(eventId, receiptId, state, now.toISOString());
    return result.changes === 1 ? { eventId, receiptId, state } : undefined;
  }

  pendingAlerts(): MaintenanceAlert[] {
    return this.#database
      .prepare<[], { event_id: string; receipt_id: string; state: MaintenanceAlert['state'] }>(
        `SELECT event_id, receipt_id, state FROM alert_outbox
         WHERE delivered_at IS NULL ORDER BY created_at, event_id`,
      )
      .all()
      .map(row => ({ eventId: row.event_id, receiptId: row.receipt_id, state: row.state }));
  }

  markAlertDelivered(eventId: string, now = this.#now()): void {
    this.#database
      .prepare('UPDATE alert_outbox SET delivered_at = ? WHERE event_id = ?')
      .run(now.toISOString(), eventId);
  }

  operations(now = this.#now()): {
    counts: Record<ReceiptState, number>;
    oldestQueuedAgeSeconds: number;
    schemaVersion: number;
  } {
    const counts = {
      accepted: 0,
      ambiguous: 0,
      claimed: 0,
      'dead-letter': 0,
      dispatching: 0,
      filed: 0,
      rejected: 0,
      retryable: 0,
      tombstone: 0,
    } satisfies Record<ReceiptState, number>;
    const rows = this.#database
      .prepare<[], { count: number; projected_state: ReceiptState }>(
        `SELECT
           CASE
             WHEN tombstoned_at IS NOT NULL THEN 'tombstone'
             WHEN dead_lettered_at IS NOT NULL THEN 'dead-letter'
             ELSE state
           END AS projected_state,
           COUNT(*) AS count
         FROM retro_requests
         GROUP BY projected_state`,
      )
      .all();
    for (const row of rows) counts[row.projected_state] = row.count;
    const oldestQueuedAt = this.#database
      .prepare<[], { oldest: string | null }>(
        `SELECT MIN(accepted_at) AS oldest
         FROM retro_requests
         WHERE state IN ('accepted', 'claimed', 'retryable')
           AND dead_lettered_at IS NULL AND tombstoned_at IS NULL`,
      )
      .get()?.oldest;
    const oldest =
      oldestQueuedAt === null || oldestQueuedAt === undefined
        ? now.getTime()
        : new Date(oldestQueuedAt).getTime();
    return {
      counts,
      oldestQueuedAgeSeconds: Math.max(0, Math.floor((now.getTime() - oldest) / 1000)),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }
}
