import { createHash, randomBytes } from 'node:crypto';

import Database from 'better-sqlite3';

import type { PayloadEnvelope } from './payload.js';
import type { FilingReceipt, ReceiptState, RequestScope } from './types.js';

type StoredState = 'accepted' | 'claimed' | 'dispatching' | 'filed' | 'ambiguous' | 'retryable';

interface RequestRow {
  accepted_at: string;
  alias_owner_request_id: string | null;
  attempt_count: number;
  dead_lettered_at: string | null;
  dispatch_started_at: string | null;
  filed_at: string | null;
  installation_id: number;
  issue_number: number | null;
  next_attempt_at: string | null;
  payload_ciphertext: Buffer;
  payload_compacted_at: string | null;
  payload_hash: string;
  payload_nonce: Buffer;
  payload_tag: Buffer;
  receipt_id: string;
  repository: string;
  request_id: string;
  request_marker: string;
  state: StoredState;
  tenant_id: string;
  tombstoned_at: string | null;
}

export interface DurableRequest {
  acceptedAt: string;
  aliasOwnerRequestId?: string;
  attemptCount: number;
  dispatchStartedAt?: string;
  envelope: PayloadEnvelope;
  issueNumber?: number;
  nextAttemptAt?: string;
  payloadHash: string;
  receiptId: string;
  requestMarker: string;
  scope: RequestScope;
  state: ReceiptState;
}

export interface AcceptInput {
  envelope: PayloadEnvelope;
  payloadHash: string;
  requestMarker: string;
  scope: RequestScope;
}

export interface MaintenanceAlert {
  eventId: string;
  receiptId: string;
  state: 'ambiguous' | 'dead-letter';
}

export class SemanticEvidenceConflictError extends Error {}

type MigrationFault = (step: 'after-columns' | 'after-outbox' | 'before-version') => void;
type ScopeRow = Pick<RequestRow, 'tenant_id' | 'installation_id' | 'repository' | 'request_id'>;

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
  'alias_owner_request_id',
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
      nonce: row.payload_nonce,
      tag: row.payload_tag,
    },
    nextAttemptAt: row.next_attempt_at ?? undefined,
    payloadHash: row.payload_hash,
    receiptId: row.receipt_id,
    requestMarker: row.request_marker,
    scope: {
      installationId: row.installation_id,
      repository: row.repository,
      requestId: row.request_id,
      tenantId: row.tenant_id,
    },
    state: projectedState(row),
    ...(row.alias_owner_request_id !== null && {
      aliasOwnerRequestId: row.alias_owner_request_id,
    }),
    ...(row.dispatch_started_at !== null && { dispatchStartedAt: row.dispatch_started_at }),
    ...(row.issue_number !== null && { issueNumber: row.issue_number }),
  };
}

function receipt(record: DurableRequest): FilingReceipt {
  return {
    receiptId: record.receiptId,
    requestId: record.scope.requestId,
    state: record.state,
    ...(record.issueNumber !== undefined && { issueNumber: record.issueNumber }),
  };
}

function tableExists(database: Database.Database, table: string): boolean {
  return (
    database
      .prepare<[string], { present: number }>(
        `SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?`,
      )
      .get(table)?.present === 1
  );
}

function columns(database: Database.Database, table: string): string[] {
  return database
    .prepare<[], { name: string }>(`PRAGMA table_info(${table})`)
    .all()
    .map(column => column.name);
}

function exactColumns(actual: string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && expected.every(column => actual.includes(column));
}

function createVersionTwo(database: Database.Database): void {
  database.exec(`
    CREATE TABLE schema_version (version INTEGER NOT NULL) STRICT;
    INSERT INTO schema_version VALUES (2);

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
      state TEXT NOT NULL CHECK (state IN (
        'accepted', 'claimed', 'dispatching', 'filed', 'ambiguous', 'retryable'
      )),
      issue_number INTEGER,
      request_marker TEXT NOT NULL,
      alias_owner_request_id TEXT,
      accepted_at TEXT NOT NULL,
      filed_at TEXT,
      dead_lettered_at TEXT,
      tombstoned_at TEXT,
      payload_compacted_at TEXT,
      next_attempt_at TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      dispatch_started_at TEXT,
      PRIMARY KEY (tenant_id, installation_id, repository, request_id)
    ) STRICT;

    CREATE TABLE semantic_evidence (
      kind TEXT NOT NULL,
      value TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      installation_id INTEGER NOT NULL,
      repository TEXT NOT NULL,
      request_id TEXT NOT NULL,
      PRIMARY KEY (tenant_id, installation_id, repository, kind, value),
      FOREIGN KEY (tenant_id, installation_id, repository, request_id)
        REFERENCES retro_requests (tenant_id, installation_id, repository, request_id)
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

    CREATE TABLE alert_outbox (
      event_id TEXT PRIMARY KEY,
      receipt_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('ambiguous', 'dead-letter')),
      created_at TEXT NOT NULL,
      delivered_at TEXT,
      FOREIGN KEY (receipt_id) REFERENCES retro_requests (receipt_id)
    ) STRICT;
  `);
}

function readSchemaVersion(database: Database.Database): number {
  if (!tableExists(database, 'schema_version')) throw new Error('schema version table is missing');
  const rows = database
    .prepare<[], { version: number }>('SELECT version FROM schema_version')
    .all();
  if (rows.length !== 1) throw new Error('schema version must contain exactly one row');
  const version = rows[0]?.version;
  if (!Number.isSafeInteger(version)) throw new Error('schema version is invalid');
  return version;
}

function validateVersionTwo(database: Database.Database): void {
  const expected = [...V1_COLUMNS, ...V2_EXTRA_COLUMNS];
  if (!exactColumns(columns(database, 'retro_requests'), expected)) {
    throw new Error('schema version two layout is partial or incompatible');
  }
  for (const table of ['semantic_evidence', 'reconciliation_audit', 'alert_outbox']) {
    if (!tableExists(database, table)) throw new Error(`schema table ${table} is missing`);
  }
}

function migrateVersionOne(database: Database.Database, fault?: MigrationFault): void {
  if (!exactColumns(columns(database, 'retro_requests'), V1_COLUMNS)) {
    throw new Error('schema version one layout is partial or incompatible');
  }
  const migrate = database.transaction(() => {
    database.exec(`
      ALTER TABLE retro_requests ADD COLUMN dead_lettered_at TEXT;
      ALTER TABLE retro_requests ADD COLUMN tombstoned_at TEXT;
      ALTER TABLE retro_requests ADD COLUMN payload_compacted_at TEXT;
      ALTER TABLE retro_requests ADD COLUMN next_attempt_at TEXT;
      ALTER TABLE retro_requests ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE retro_requests ADD COLUMN dispatch_started_at TEXT;
      UPDATE retro_requests SET next_attempt_at = accepted_at WHERE next_attempt_at IS NULL;
    `);
    fault?.('after-columns');
    database.exec(`
      CREATE TABLE alert_outbox (
        event_id TEXT PRIMARY KEY,
        receipt_id TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('ambiguous', 'dead-letter')),
        created_at TEXT NOT NULL,
        delivered_at TEXT,
        FOREIGN KEY (receipt_id) REFERENCES retro_requests (receipt_id)
      ) STRICT;
    `);
    fault?.('after-outbox');
    fault?.('before-version');
    database.exec('UPDATE schema_version SET version = 2;');
  });
  migrate.immediate();
}

function prepareDatabase(
  database: Database.Database,
  fault?: (step: 'after-columns' | 'after-outbox' | 'before-version') => void,
): void {
  if (!tableExists(database, 'schema_version')) {
    createVersionTwo(database);
    return;
  }
  const version = readSchemaVersion(database);
  if (version === 1) migrateVersionOne(database, fault);
  else if (version === 2) validateVersionTwo(database);
  else throw new Error(`schema version ${version} is newer than this relay`);
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
      validateVersionTwo(database);
      return new RelayStore(database, options.now ?? (() => new Date()));
    } catch (error) {
      database.close();
      throw error;
    }
  }

  readonly #database: Database.Database;
  readonly #now: () => Date;

  private constructor(database: Database.Database, now: () => Date) {
    this.#database = database;
    this.#now = now;
  }

  #resolvedAliasReceipt(record: DurableRequest): FilingReceipt {
    if (record.aliasOwnerRequestId === undefined) return receipt(record);
    const owner = this.load({ ...record.scope, requestId: record.aliasOwnerRequestId });
    if (owner?.state === 'filed' && owner.issueNumber !== undefined && record.state !== 'filed') {
      return this.markFiled(record.scope, owner.issueNumber, this.#now());
    }
    if (owner?.state === 'ambiguous' && record.state !== 'ambiguous') {
      this.#database
        .prepare(
          `UPDATE retro_requests SET state = 'ambiguous'
           WHERE tenant_id = ? AND installation_id = ? AND repository = ?
             AND request_id = ? AND alias_owner_request_id IS NOT NULL
             AND state IN ('claimed', 'dispatching', 'retryable')`,
        )
        .run(
          record.scope.tenantId,
          record.scope.installationId,
          record.scope.repository,
          record.scope.requestId,
        );
      const quarantined = this.load(record.scope);
      if (quarantined === undefined) throw new Error('alias request disappeared');
      return receipt(quarantined);
    }
    return receipt(record);
  }

  accept(input: AcceptInput): { inserted: boolean; record: DurableRequest } {
    const acceptedAt = this.#now().toISOString();
    const receiptId = randomBytes(32).toString('base64url');
    const result = this.#database
      .prepare(
        `INSERT INTO retro_requests (
          tenant_id, installation_id, repository, request_id, receipt_id,
          payload_hash, payload_nonce, payload_ciphertext, payload_tag,
          state, issue_number, request_marker, accepted_at, next_attempt_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted', NULL, ?, ?, ?)
        ON CONFLICT (tenant_id, installation_id, repository, request_id) DO NOTHING`,
      )
      .run(
        input.scope.tenantId,
        input.scope.installationId,
        input.scope.repository,
        input.scope.requestId,
        receiptId,
        input.payloadHash,
        input.envelope.nonce,
        input.envelope.ciphertext,
        input.envelope.tag,
        input.requestMarker,
        acceptedAt,
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
             AND julianday(?) < julianday(accepted_at, '+24 hours')`,
        )
        .run(
          scope.tenantId,
          scope.installationId,
          scope.repository,
          scope.requestId,
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
           AND julianday(?) < julianday(accepted_at, '+24 hours')
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
             AND julianday(?) < julianday(accepted_at, '+24 hours')`,
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

  loadByReceipt(receiptId: string): DurableRequest | undefined {
    const row = this.#database
      .prepare<[string], RequestRow>('SELECT * FROM retro_requests WHERE receipt_id = ?')
      .get(receiptId);
    return row === undefined ? undefined : rowToRequest(row);
  }

  linkAlias(scope: RequestScope, owner: DurableRequest): FilingReceipt {
    this.#database
      .prepare(
        `UPDATE retro_requests SET alias_owner_request_id = ?
         WHERE tenant_id = ? AND installation_id = ? AND repository = ?
           AND request_id = ? AND state = 'claimed' AND dead_lettered_at IS NULL`,
      )
      .run(
        owner.scope.requestId,
        scope.tenantId,
        scope.installationId,
        scope.repository,
        scope.requestId,
      );
    const linked = this.receipt(scope);
    if (linked === undefined) throw new Error('alias request disappeared');
    return linked;
  }

  markAmbiguous(scope: RequestScope, now = this.#now()): void {
    const transition = this.#database.transaction(() => {
      const row = this.#database
        .prepare<[string, number, string, string], Pick<RequestRow, 'receipt_id'>>(
          `UPDATE retro_requests SET state = 'ambiguous'
           WHERE tenant_id = ? AND installation_id = ? AND repository = ?
             AND request_id = ? AND state IN ('claimed', 'dispatching')
             AND dead_lettered_at IS NULL
           RETURNING receipt_id`,
        )
        .get(scope.tenantId, scope.installationId, scope.repository, scope.requestId);
      if (row !== undefined) this.#insertAlert(row.receipt_id, 'ambiguous', now);
    });
    transition.immediate();
  }

  markFiled(scope: RequestScope, issueNumber: number, now = this.#now()): FilingReceipt {
    const result = this.#database
      .prepare(
        `UPDATE retro_requests SET state = 'filed', issue_number = ?, filed_at = ?
         WHERE tenant_id = ? AND installation_id = ? AND repository = ? AND request_id = ?
           AND dead_lettered_at IS NULL AND tombstoned_at IS NULL
           AND (
             (state = 'claimed' AND julianday(?) < julianday(accepted_at, '+24 hours'))
             OR
             (state = 'dispatching' AND julianday(?) < julianday(accepted_at, '+25 hours'))
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
    return receipt(record);
  }

  markReconciledFiled(scope: RequestScope, issueNumber: number, now = this.#now()): FilingReceipt {
    const result = this.#database
      .prepare(
        `UPDATE retro_requests SET state = 'filed', issue_number = ?, filed_at = ?
         WHERE tenant_id = ? AND installation_id = ? AND repository = ? AND request_id = ?
           AND state = 'ambiguous' AND tombstoned_at IS NULL`,
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
    return receipt(record);
  }

  markRetryable(scope: RequestScope, now = this.#now()): void {
    const record = this.load(scope);
    if (record === undefined) return;
    const deadline = new Date(new Date(record.acceptedAt).getTime() + DAY_MS);
    const backoff = Math.min(2 ** Math.max(record.attemptCount - 1, 0) * 60_000, HOUR_MS);
    const nextAttempt = new Date(Math.min(now.getTime() + backoff, deadline.getTime()));
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
    return record === undefined ? undefined : this.#resolvedAliasReceipt(record);
  }

  receiptById(receiptId: string): FilingReceipt | undefined {
    const record = this.loadByReceipt(receiptId);
    return record === undefined ? undefined : this.#resolvedAliasReceipt(record);
  }

  recordReconciliation(
    receiptId: string,
    actorSubject: string,
    disposition: 'adopted' | 'incomplete' | 'multiple' | 'zero',
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

  reserveEvidence(
    scope: RequestScope,
    evidence: { kind: 'canonical' | 'legacy'; value: string }[],
  ): DurableRequest {
    const reserve = this.#database.transaction(() => {
      let existingOwner: DurableRequest | undefined;
      for (const item of evidence) {
        const owner = this.#database
          .prepare<[string, number, string, string, string], ScopeRow>(
            `SELECT tenant_id, installation_id, repository, request_id
             FROM semantic_evidence
             WHERE tenant_id = ? AND installation_id = ? AND repository = ?
               AND kind = ? AND value = ?`,
          )
          .get(scope.tenantId, scope.installationId, scope.repository, item.kind, item.value);
        if (owner === undefined) continue;
        const record = this.load({
          installationId: owner.installation_id,
          repository: owner.repository,
          requestId: owner.request_id,
          tenantId: owner.tenant_id,
        });
        if (record === undefined) throw new Error('evidence owner disappeared');
        if (
          existingOwner !== undefined &&
          existingOwner.scope.requestId !== record.scope.requestId
        ) {
          throw new SemanticEvidenceConflictError(
            'canonical and legacy evidence belong to different requests',
          );
        }
        existingOwner = record;
      }
      if (existingOwner !== undefined) return existingOwner;
      for (const item of evidence) {
        this.#database
          .prepare(
            `INSERT INTO semantic_evidence (
              kind, value, tenant_id, installation_id, repository, request_id
            ) VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            item.kind,
            item.value,
            scope.tenantId,
            scope.installationId,
            scope.repository,
            scope.requestId,
          );
      }
      const record = this.load(scope);
      if (record === undefined) throw new Error('evidence request disappeared');
      return record;
    });
    return reserve.immediate();
  }

  evidenceOwner(kind: 'canonical' | 'legacy', value: string): DurableRequest | undefined {
    const row = this.#database
      .prepare<[string, string], ScopeRow>(
        `SELECT tenant_id, installation_id, repository, request_id
         FROM semantic_evidence WHERE kind = ? AND value = ?`,
      )
      .get(kind, value);
    return row === undefined
      ? undefined
      : this.load({
          installationId: row.installation_id,
          repository: row.repository,
          requestId: row.request_id,
          tenantId: row.tenant_id,
        });
  }

  schemaVersion(): number {
    return readSchemaVersion(this.#database);
  }

  recoverInFlight(): void {
    const now = this.#now().toISOString();
    const recover = this.#database.transaction(() => {
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
    });
    recover.immediate();
  }

  maintain(now = this.#now()): { alerts: MaintenanceAlert[] } {
    const maintain = this.#database.transaction(() => {
      const alerts: MaintenanceAlert[] = [];
      const deadLetters = this.#database
        .prepare<[string], Pick<RequestRow, 'receipt_id'>>(
          `SELECT receipt_id FROM retro_requests
           WHERE state IN ('accepted', 'retryable', 'claimed')
             AND dead_lettered_at IS NULL
             AND julianday(?) >= julianday(accepted_at, '+24 hours')`,
        )
        .all(now.toISOString());
      for (const item of deadLetters) {
        const result = this.#database
          .prepare(
            `UPDATE retro_requests SET dead_lettered_at = ?
             WHERE receipt_id = ? AND state IN ('accepted', 'retryable', 'claimed')
               AND dead_lettered_at IS NULL
               AND julianday(?) >= julianday(accepted_at, '+24 hours')`,
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
             AND julianday(?) >= julianday(accepted_at, '+25 hours')`,
        )
        .all(now.toISOString());
      for (const item of ambiguous) {
        const result = this.#database
          .prepare(
            `UPDATE retro_requests SET state = 'ambiguous'
             WHERE receipt_id = ? AND state = 'dispatching'
               AND julianday(?) >= julianday(accepted_at, '+25 hours')`,
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
           WHERE state = 'filed' AND tombstoned_at IS NULL
             AND julianday(?) >= julianday(filed_at, '+30 days')`,
        )
        .run(now.toISOString(), now.toISOString(), now.toISOString());
      return { alerts };
    });
    return maintain.immediate();
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
      retryable: 0,
      tombstone: 0,
    } satisfies Record<ReceiptState, number>;
    const rows = this.#database.prepare<[], RequestRow>('SELECT * FROM retro_requests').all();
    for (const row of rows) counts[projectedState(row)] += 1;
    const queuedDates = rows
      .filter(row => ['accepted', 'claimed', 'retryable'].includes(projectedState(row)))
      .map(row => new Date(row.accepted_at).getTime());
    const oldest = queuedDates.length === 0 ? now.getTime() : Math.min(...queuedDates);
    return {
      counts,
      oldestQueuedAgeSeconds: Math.max(0, Math.floor((now.getTime() - oldest) / 1000)),
      schemaVersion: 2,
    };
  }
}
