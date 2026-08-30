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
  project_uuid: string;
}

export class PublicRetroConflict extends Error {}
export class PublicRetroQuotaExceeded extends Error {}

export interface PublicRetroStoreOptions {
  filingLimitPerHour?: number;
  intakeLimitPerMinute?: number;
  now?: () => number;
  projectFilingLimitPerHour?: number;
}

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
  readonly #intakeLimitPerMinute: number;
  readonly #filingLimitPerHour: number;
  readonly #now: () => number;
  readonly #projectFilingLimitPerHour: number;

  constructor(databasePath: string, options: PublicRetroStoreOptions = {}) {
    this.#database = new DatabaseSync(databasePath);
    this.#intakeLimitPerMinute = options.intakeLimitPerMinute ?? 60;
    this.#filingLimitPerHour = options.filingLimitPerHour ?? 20;
    this.#now = options.now ?? Date.now;
    this.#projectFilingLimitPerHour = options.projectFilingLimitPerHour ?? 5;
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
        project_uuid TEXT NOT NULL,
        lease_token TEXT,
        lease_expires_at INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT
      ) STRICT;
      CREATE TABLE IF NOT EXISTS intake_events (
        request_id TEXT PRIMARY KEY,
        accepted_at_ms INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS intake_events_accepted_at ON intake_events (accepted_at_ms);
      CREATE TABLE IF NOT EXISTS filing_reservations (
        request_id TEXT PRIMARY KEY,
        project_uuid TEXT NOT NULL,
        reserved_at_ms INTEGER NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('reserved', 'committed'))
      ) STRICT;
      CREATE INDEX IF NOT EXISTS filing_reservations_time
        ON filing_reservations (reserved_at_ms, project_uuid);
    `);
  }

  private acceptServer(
    requestId: string,
    sessionScope: string,
    projectUUID: string,
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
      const now = this.#now();
      const admitted = this.#database
        .prepare('SELECT COUNT(*) AS count FROM intake_events WHERE accepted_at_ms > ?')
        .get(now - 60_000) as { count: number };
      if (admitted.count >= this.#intakeLimitPerMinute) {
        throw new PublicRetroQuotaExceeded('public intake quota exhausted');
      }
      const receipt = randomUUID();
      this.#database
        .prepare(
          `INSERT INTO server_retros
             (request_id, session_scope, raw_body, receipt, accepted_at, body_digest, project_uuid)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          requestId,
          sessionScope,
          rawBody,
          receipt,
          new Date().toISOString(),
          createHash('sha256').update(rawBody).digest('hex'),
          projectUUID,
        );
      this.#database
        .prepare('INSERT INTO intake_events (request_id, accepted_at_ms) VALUES (?, ?)')
        .run(requestId, now);
      this.#database.exec('COMMIT;');
      return { receipt, requestId, status: 'accepted' };
    } catch (error) {
      if (this.#database.isTransaction) this.#database.exec('ROLLBACK;');
      throw error;
    }
  }

  private hasFilingCapacity(stored: StoredServerRetro, now: number): boolean {
    const existing = this.#database
      .prepare('SELECT request_id FROM filing_reservations WHERE request_id = ?')
      .get(stored.request_id);
    if (existing !== undefined) return true;
    const cutoff = now - 3_600_000;
    const global = this.#database
      .prepare('SELECT COUNT(*) AS count FROM filing_reservations WHERE reserved_at_ms > ?')
      .get(cutoff) as { count: number };
    if (global.count >= this.#filingLimitPerHour) return false;
    const project = this.#database
      .prepare(
        'SELECT COUNT(*) AS count FROM filing_reservations WHERE reserved_at_ms > ? AND project_uuid = ?',
      )
      .get(cutoff, stored.project_uuid) as { count: number };
    return project.count < this.#projectFilingLimitPerHour;
  }

  accept(
    requestId: string,
    sessionScope: string,
    rawBody: Uint8Array,
    envelopeVersion: 'legacy' | 'v3' = 'legacy',
    projectUUID = '',
  ): AcceptedPublicRetro {
    if (envelopeVersion === 'v3')
      return this.acceptServer(requestId, sessionScope, projectUUID, rawBody);
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
      const candidates = this.#database
        .prepare(
          `SELECT request_id, raw_body, receipt, accepted_at, body_digest, project_uuid
             FROM server_retros
            WHERE completed_at IS NULL
              AND (lease_token IS NULL OR lease_expires_at <= ?)
            ORDER BY accepted_at, request_id
            LIMIT 100`,
        )
        .all(now) as unknown as StoredServerRetro[];
      const stored = candidates.find(candidate => this.hasFilingCapacity(candidate, now));
      if (stored === undefined) {
        this.#database.exec('COMMIT;');
        return undefined;
      }
      const leaseToken = randomUUID();
      this.#database
        .prepare(
          `INSERT INTO filing_reservations (request_id, project_uuid, reserved_at_ms, state)
           VALUES (?, ?, ?, 'reserved')
           ON CONFLICT (request_id) DO NOTHING`,
        )
        .run(stored.request_id, stored.project_uuid, now);
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
    this.#database.exec('BEGIN IMMEDIATE;');
    try {
      const result = this.#database
        .prepare(
          `UPDATE server_retros
            SET lease_token = NULL, lease_expires_at = NULL
          WHERE request_id = ? AND lease_token = ? AND completed_at IS NULL`,
        )
        .run(requestId, leaseToken);
      if (result.changes === 1) {
        this.#database
          .prepare("DELETE FROM filing_reservations WHERE request_id = ? AND state = 'reserved'")
          .run(requestId);
      }
      this.#database.exec('COMMIT;');
      return result.changes === 1;
    } catch (error) {
      if (this.#database.isTransaction) this.#database.exec('ROLLBACK;');
      throw error;
    }
  }

  complete(requestId: string, leaseToken: string): boolean {
    this.#database.exec('BEGIN IMMEDIATE;');
    try {
      const result = this.#database
        .prepare(
          `UPDATE server_retros
            SET completed_at = ?, lease_token = NULL, lease_expires_at = NULL
          WHERE request_id = ? AND lease_token = ? AND completed_at IS NULL`,
        )
        .run(new Date(this.#now()).toISOString(), requestId, leaseToken);
      if (result.changes === 1) {
        this.#database
          .prepare(
            "UPDATE filing_reservations SET state = 'committed' WHERE request_id = ? AND state = 'reserved'",
          )
          .run(requestId);
      }
      this.#database.exec('COMMIT;');
      return result.changes === 1;
    } catch (error) {
      if (this.#database.isTransaction) this.#database.exec('ROLLBACK;');
      throw error;
    }
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
