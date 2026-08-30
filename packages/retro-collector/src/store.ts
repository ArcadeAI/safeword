import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export interface AcceptedPublicRetro {
  receipt: string;
  requestId: string;
  status: 'accepted' | 'duplicate';
}

interface StoredPublicRetro {
  raw_body: Uint8Array;
  receipt: string;
  request_id: string;
  session_scope: string;
}

interface StoredServerRetro {
  accepted_at: string;
  body_digest: string;
  raw_body: Uint8Array;
  receipt: string;
  request_id: string;
}

export class PublicRetroConflict extends Error {}

export interface ClaimedPublicRetro {
  acceptedAt: string;
  bodyBase64: string;
  digest: string;
  leaseToken: string;
  receipt: string;
  requestId: string;
}

export class PublicRetroStore {
  readonly #database: DatabaseSync;

  constructor(databasePath: string) {
    this.#database = new DatabaseSync(databasePath);
    this.#database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS public_retros (
        request_id TEXT PRIMARY KEY,
        session_scope TEXT NOT NULL UNIQUE,
        raw_body BLOB NOT NULL,
        receipt TEXT NOT NULL UNIQUE
      ) STRICT;
      CREATE TABLE IF NOT EXISTS server_retros (
        request_id TEXT PRIMARY KEY,
        session_scope TEXT NOT NULL,
        raw_body BLOB NOT NULL,
        receipt TEXT NOT NULL UNIQUE,
        accepted_at TEXT NOT NULL,
        body_digest TEXT NOT NULL,
        lease_token TEXT,
        lease_expires_at INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT
      ) STRICT;
    `);
  }

  private acceptServer(
    requestId: string,
    sessionScope: string,
    rawBody: Uint8Array,
  ): AcceptedPublicRetro {
    this.#database.exec('BEGIN IMMEDIATE;');
    try {
      const existing = this.#database
        .prepare('SELECT request_id, raw_body, receipt FROM server_retros WHERE request_id = ?')
        .get(requestId) as StoredServerRetro | undefined;
      if (existing !== undefined) {
        if (!Buffer.from(existing.raw_body).equals(rawBody)) {
          throw new PublicRetroConflict('request identity already has different raw bytes');
        }
        this.#database.exec('COMMIT;');
        return { receipt: existing.receipt, requestId, status: 'duplicate' };
      }
      const receipt = randomUUID();
      this.#database
        .prepare(
          `INSERT INTO server_retros
             (request_id, session_scope, raw_body, receipt, accepted_at, body_digest)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          requestId,
          sessionScope,
          rawBody,
          receipt,
          new Date().toISOString(),
          createHash('sha256').update(rawBody).digest('hex'),
        );
      this.#database.exec('COMMIT;');
      return { receipt, requestId, status: 'accepted' };
    } catch (error) {
      if (this.#database.isTransaction) this.#database.exec('ROLLBACK;');
      throw error;
    }
  }

  accept(
    requestId: string,
    sessionScope: string,
    rawBody: Uint8Array,
    envelopeVersion: 'legacy' | 'v3' = 'legacy',
  ): AcceptedPublicRetro {
    if (envelopeVersion === 'v3') return this.acceptServer(requestId, sessionScope, rawBody);
    this.#database.exec('BEGIN IMMEDIATE;');
    try {
      const existing = this.#database
        .prepare(
          'SELECT request_id, session_scope, raw_body, receipt FROM public_retros WHERE request_id = ?',
        )
        .get(requestId) as StoredPublicRetro | undefined;
      if (existing !== undefined) {
        if (!Buffer.from(existing.raw_body).equals(rawBody)) {
          throw new PublicRetroConflict('request identity already has different raw bytes');
        }
        this.#database.exec('COMMIT;');
        return {
          receipt: existing.receipt,
          requestId: existing.request_id,
          status: 'duplicate',
        };
      }

      const scopeOwner = this.#database
        .prepare(
          'SELECT request_id, session_scope, raw_body, receipt FROM public_retros WHERE session_scope = ?',
        )
        .get(sessionScope) as StoredPublicRetro | undefined;
      if (scopeOwner !== undefined) {
        if (!Buffer.from(scopeOwner.raw_body).equals(rawBody)) {
          throw new PublicRetroConflict('session scope already has different raw bytes');
        }
        this.#database.exec('COMMIT;');
        return { receipt: scopeOwner.receipt, requestId, status: 'duplicate' };
      }

      const receipt = randomUUID();
      this.#database
        .prepare(
          'INSERT INTO public_retros (request_id, session_scope, raw_body, receipt) VALUES (?, ?, ?, ?)',
        )
        .run(requestId, sessionScope, rawBody, receipt);
      this.#database.exec('COMMIT;');
      return { receipt, requestId, status: 'accepted' };
    } catch (error) {
      if (this.#database.isTransaction) this.#database.exec('ROLLBACK;');
      throw error;
    }
  }

  claim(now = Date.now(), leaseMilliseconds = 60_000): ClaimedPublicRetro | undefined {
    this.#database.exec('BEGIN IMMEDIATE;');
    try {
      const stored = this.#database
        .prepare(
          `SELECT request_id, raw_body, receipt, accepted_at, body_digest
             FROM server_retros
            WHERE completed_at IS NULL
              AND (lease_token IS NULL OR lease_expires_at <= ?)
            ORDER BY accepted_at, request_id
            LIMIT 1`,
        )
        .get(now) as StoredServerRetro | undefined;
      if (stored === undefined) {
        this.#database.exec('COMMIT;');
        return undefined;
      }
      const leaseToken = randomUUID();
      this.#database
        .prepare(
          'UPDATE server_retros SET lease_token = ?, lease_expires_at = ?, attempts = attempts + 1 WHERE request_id = ?',
        )
        .run(leaseToken, now + leaseMilliseconds, stored.request_id);
      this.#database.exec('COMMIT;');
      return {
        acceptedAt: stored.accepted_at,
        bodyBase64: Buffer.from(stored.raw_body).toString('base64'),
        digest: stored.body_digest,
        leaseToken,
        receipt: stored.receipt,
        requestId: stored.request_id,
      };
    } catch (error) {
      if (this.#database.isTransaction) this.#database.exec('ROLLBACK;');
      throw error;
    }
  }

  release(requestId: string, leaseToken: string): boolean {
    const result = this.#database
      .prepare(
        `UPDATE server_retros
            SET lease_token = NULL, lease_expires_at = NULL
          WHERE request_id = ? AND lease_token = ? AND completed_at IS NULL`,
      )
      .run(requestId, leaseToken);
    return result.changes === 1;
  }

  complete(requestId: string, leaseToken: string): boolean {
    const result = this.#database
      .prepare(
        `UPDATE server_retros
            SET completed_at = ?, lease_token = NULL, lease_expires_at = NULL
          WHERE request_id = ? AND lease_token = ? AND completed_at IS NULL`,
      )
      .run(new Date().toISOString(), requestId, leaseToken);
    return result.changes === 1;
  }

  read(receipt: string): { rawBody: Uint8Array; receipt: string } | undefined {
    const stored = this.#database
      .prepare('SELECT raw_body, receipt FROM public_retros WHERE receipt = ?')
      .get(receipt) as Pick<StoredPublicRetro, 'raw_body' | 'receipt'> | undefined;
    return stored === undefined ? undefined : { rawBody: stored.raw_body, receipt: stored.receipt };
  }

  close(): void {
    this.#database.close();
  }
}
