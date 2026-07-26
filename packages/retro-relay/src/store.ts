import { randomBytes } from 'node:crypto';

import Database from 'better-sqlite3';

import type { PayloadEnvelope } from './payload.js';
import type { FilingReceipt, ReceiptState, RequestScope } from './types.js';

interface RequestRow {
  tenant_id: string;
  installation_id: number;
  repository: string;
  request_id: string;
  receipt_id: string;
  payload_hash: string;
  payload_nonce: Buffer;
  payload_ciphertext: Buffer;
  payload_tag: Buffer;
  state: ReceiptState;
  issue_number: number | null;
  request_marker: string;
  alias_owner_request_id: string | null;
}

export interface DurableRequest {
  scope: RequestScope;
  receiptId: string;
  payloadHash: string;
  envelope: PayloadEnvelope;
  state: ReceiptState;
  issueNumber?: number;
  requestMarker: string;
  aliasOwnerRequestId?: string;
}

export interface AcceptInput {
  scope: RequestScope;
  payloadHash: string;
  envelope: PayloadEnvelope;
  requestMarker: string;
}

export class SemanticEvidenceConflictError extends Error {}

function rowToRequest(row: RequestRow): DurableRequest {
  return {
    scope: {
      tenantId: row.tenant_id,
      installationId: row.installation_id,
      repository: row.repository,
      requestId: row.request_id,
    },
    receiptId: row.receipt_id,
    payloadHash: row.payload_hash,
    envelope: {
      nonce: row.payload_nonce,
      ciphertext: row.payload_ciphertext,
      tag: row.payload_tag,
    },
    state: row.state,
    ...(row.issue_number !== null && { issueNumber: row.issue_number }),
    requestMarker: row.request_marker,
    ...(row.alias_owner_request_id !== null && {
      aliasOwnerRequestId: row.alias_owner_request_id,
    }),
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

export class RelayStore {
  static open(databasePath: string): RelayStore {
    const database = new Database(databasePath, { timeout: 5000 });
    database.pragma('journal_mode = WAL');
    database.pragma('synchronous = FULL');
    database.pragma('foreign_keys = ON');
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL
      ) STRICT;
      INSERT INTO schema_version (version)
      SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM schema_version);

      CREATE TABLE IF NOT EXISTS retro_requests (
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
        PRIMARY KEY (tenant_id, installation_id, repository, request_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS semantic_evidence (
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

      CREATE TABLE IF NOT EXISTS reconciliation_audit (
        audit_id INTEGER PRIMARY KEY,
        receipt_id TEXT NOT NULL,
        actor_subject TEXT NOT NULL,
        disposition TEXT NOT NULL,
        match_count INTEGER NOT NULL,
        recorded_at TEXT NOT NULL,
        FOREIGN KEY (receipt_id) REFERENCES retro_requests (receipt_id)
      ) STRICT;
    `);
    return new RelayStore(database);
  }

  readonly #database: Database.Database;

  private constructor(database: Database.Database) {
    this.#database = database;
  }

  #resolvedAliasReceipt(record: DurableRequest): FilingReceipt {
    if (record.aliasOwnerRequestId === undefined) return receipt(record);
    const owner = this.load({
      ...record.scope,
      requestId: record.aliasOwnerRequestId,
    });
    if (owner?.state === 'filed' && owner.issueNumber !== undefined && record.state !== 'filed') {
      return this.markFiled(record.scope, owner.issueNumber);
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

  accept(input: AcceptInput): { record: DurableRequest; inserted: boolean } {
    const receiptId = randomBytes(32).toString('base64url');
    const result = this.#database
      .prepare(
        `INSERT INTO retro_requests (
          tenant_id, installation_id, repository, request_id, receipt_id,
          payload_hash, payload_nonce, payload_ciphertext, payload_tag,
          state, issue_number, request_marker, accepted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted', NULL, ?, ?)
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
        new Date().toISOString(),
      );
    const record = this.load(input.scope);
    if (record === undefined) throw new Error('accepted request disappeared');
    return { record, inserted: result.changes === 1 };
  }

  claim(scope: RequestScope): boolean {
    return (
      this.#database
        .prepare(
          `UPDATE retro_requests SET state = 'claimed'
           WHERE tenant_id = ? AND installation_id = ? AND repository = ?
             AND request_id = ? AND state IN ('accepted', 'retryable')`,
        )
        .run(scope.tenantId, scope.installationId, scope.repository, scope.requestId).changes === 1
    );
  }

  beginDispatch(scope: RequestScope): boolean {
    return (
      this.#database
        .prepare(
          `UPDATE retro_requests SET state = 'dispatching'
           WHERE tenant_id = ? AND installation_id = ? AND repository = ?
             AND request_id = ? AND state = 'claimed'`,
        )
        .run(scope.tenantId, scope.installationId, scope.repository, scope.requestId).changes === 1
    );
  }

  close(): void {
    this.#database.close();
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
        `UPDATE retro_requests
         SET alias_owner_request_id = ?
         WHERE tenant_id = ? AND installation_id = ? AND repository = ?
           AND request_id = ? AND state = 'claimed'`,
      )
      .run(
        owner.scope.requestId,
        scope.tenantId,
        scope.installationId,
        scope.repository,
        scope.requestId,
      );
    return (
      this.receipt(scope) ??
      (() => {
        throw new Error('alias request disappeared');
      })()
    );
  }

  markAmbiguous(scope: RequestScope): void {
    this.#database
      .prepare(
        `UPDATE retro_requests SET state = 'ambiguous'
         WHERE tenant_id = ? AND installation_id = ? AND repository = ?
           AND request_id = ? AND state IN ('claimed', 'dispatching')`,
      )
      .run(scope.tenantId, scope.installationId, scope.repository, scope.requestId);
  }

  markFiled(scope: RequestScope, issueNumber: number): FilingReceipt {
    this.#database
      .prepare(
        `UPDATE retro_requests
         SET state = 'filed', issue_number = ?, filed_at = ?
         WHERE tenant_id = ? AND installation_id = ? AND repository = ?
           AND request_id = ? AND state IN ('claimed', 'dispatching', 'ambiguous')`,
      )
      .run(
        issueNumber,
        new Date().toISOString(),
        scope.tenantId,
        scope.installationId,
        scope.repository,
        scope.requestId,
      );
    const record = this.load(scope);
    if (record === undefined) throw new Error('filed request disappeared');
    return receipt(record);
  }

  markRetryable(scope: RequestScope): void {
    this.#database
      .prepare(
        `UPDATE retro_requests SET state = 'retryable'
         WHERE tenant_id = ? AND installation_id = ? AND repository = ?
           AND request_id = ? AND state IN ('claimed', 'dispatching')`,
      )
      .run(scope.tenantId, scope.installationId, scope.repository, scope.requestId);
  }

  receipt(scope: RequestScope): FilingReceipt | undefined {
    const record = this.load(scope);
    if (record === undefined) return undefined;
    return this.#resolvedAliasReceipt(record);
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
      .run(receiptId, actorSubject, disposition, matchCount, new Date().toISOString());
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
          .prepare<
            [string, number, string, string, string],
            Pick<RequestRow, 'tenant_id' | 'installation_id' | 'repository' | 'request_id'>
          >(
            `SELECT tenant_id, installation_id, repository, request_id
             FROM semantic_evidence
             WHERE tenant_id = ? AND installation_id = ? AND repository = ?
               AND kind = ? AND value = ?`,
          )
          .get(scope.tenantId, scope.installationId, scope.repository, item.kind, item.value);
        if (owner !== undefined) {
          const record = this.load({
            tenantId: owner.tenant_id,
            installationId: owner.installation_id,
            repository: owner.repository,
            requestId: owner.request_id,
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

  schemaVersion(): number {
    const row = this.#database
      .prepare<[], { version: number }>('SELECT version FROM schema_version')
      .get();
    if (row === undefined) throw new Error('schema version row is missing');
    return row.version;
  }

  recoverInFlight(): void {
    this.#database
      .prepare(`UPDATE retro_requests SET state = 'retryable' WHERE state = 'claimed'`)
      .run();
    this.#database
      .prepare(`UPDATE retro_requests SET state = 'ambiguous' WHERE state = 'dispatching'`)
      .run();
  }
}
