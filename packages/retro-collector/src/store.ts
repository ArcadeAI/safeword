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
  attempts: number;
  body_digest: string;
  next_attempt_at: number;
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

export interface PublicRetroLifecycle {
  acceptedAt: string;
  attempts: number;
  completedAt?: string;
  leaseExpiresAt?: number;
  receipt: string;
  requestId: string;
  state: 'completed' | 'dead-lettered' | 'leased' | 'queued';
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
        completed_at TEXT,
        dead_lettered_at TEXT,
        terminal_reason TEXT,
        next_attempt_at INTEGER NOT NULL DEFAULT 0
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
      CREATE TABLE IF NOT EXISTS payload_access_audit (
        id INTEGER PRIMARY KEY,
        request_id TEXT NOT NULL,
        principal TEXT NOT NULL,
        accessed_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS operator_alerts (
        request_id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
    `);
    const serverColumns = this.#database.prepare('PRAGMA table_info(server_retros)').all() as {
      name: string;
    }[];
    if (serverColumns.every(column => column.name !== 'next_attempt_at')) {
      this.#database.exec(
        'ALTER TABLE server_retros ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0',
      );
    }
  }

  private assertIntakeCapacity(now: number): void {
    const admitted = this.#database
      .prepare('SELECT COUNT(*) AS count FROM intake_events WHERE accepted_at_ms > ?')
      .get(now - 60_000) as { count: number };
    if (admitted.count >= this.#intakeLimitPerMinute) {
      throw new PublicRetroQuotaExceeded('public intake quota exhausted');
    }
  }

  private recordIntake(envelopeFamily: 'legacy' | 'v3', requestId: string, now: number): void {
    this.#database
      .prepare('INSERT INTO intake_events (request_id, accepted_at_ms) VALUES (?, ?)')
      .run(`${envelopeFamily}:${requestId}`, now);
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
      this.assertIntakeCapacity(now);
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
          new Date(now).toISOString(),
          createHash('sha256').update(rawBody).digest('hex'),
          projectUUID,
        );
      this.recordIntake('v3', requestId, now);
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

  private deadLetterQuotaBlocked(stored: StoredServerRetro, now: number): boolean {
    if (Date.parse(stored.accepted_at) > now - 86_400_000) return false;
    const deadLetteredAt = new Date(now).toISOString();
    this.#database
      .prepare(
        `UPDATE server_retros
            SET dead_lettered_at = ?, terminal_reason = 'quota_exhausted',
                lease_token = NULL, lease_expires_at = NULL
          WHERE request_id = ? AND completed_at IS NULL AND dead_lettered_at IS NULL`,
      )
      .run(deadLetteredAt, stored.request_id);
    this.#database
      .prepare("DELETE FROM filing_reservations WHERE request_id = ? AND state = 'reserved'")
      .run(stored.request_id);
    this.#database
      .prepare(
        `INSERT INTO operator_alerts (request_id, code, created_at)
         VALUES (?, 'quota_exhausted', ?)
         ON CONFLICT (request_id) DO NOTHING`,
      )
      .run(stored.request_id, deadLetteredAt);
    return true;
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

      const now = this.#now();
      this.assertIntakeCapacity(now);
      const receipt = randomUUID();
      this.#database
        .prepare(
          'INSERT INTO public_retros (request_id, session_scope, raw_body, receipt) VALUES (?, ?, ?, ?)',
        )
        .run(requestId, sessionScope, rawBody, receipt);
      this.recordIntake('legacy', requestId, now);
      this.#database.exec('COMMIT;');
      return { receipt, requestId, status: 'accepted' };
    } catch (error) {
      if (this.#database.isTransaction) this.#database.exec('ROLLBACK;');
      throw error;
    }
  }

  claim(now = this.#now(), leaseMilliseconds = 60_000): ClaimedPublicRetro | undefined {
    this.#database.exec('BEGIN IMMEDIATE;');
    try {
      const candidates = this.#database
        .prepare(
          `SELECT request_id, raw_body, receipt, accepted_at, body_digest, project_uuid,
                  attempts, next_attempt_at
             FROM server_retros
            WHERE completed_at IS NULL
              AND dead_lettered_at IS NULL
              AND next_attempt_at <= ?
              AND (lease_token IS NULL OR lease_expires_at <= ?)
            ORDER BY next_attempt_at, accepted_at, request_id`,
        )
        .all(now, now) as unknown as StoredServerRetro[];
      const stored = candidates.find(candidate => {
        if (this.hasFilingCapacity(candidate, now)) return true;
        this.deadLetterQuotaBlocked(candidate, now);
        return false;
      });
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
      this.#database
        .prepare(
          'INSERT INTO payload_access_audit (request_id, principal, accessed_at) VALUES (?, ?, ?)',
        )
        .run(stored.request_id, 'collector-worker', new Date(now).toISOString());
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

  listLifecycle(): PublicRetroLifecycle[] {
    const now = this.#now();
    const rows = this.#database
      .prepare(
        `SELECT request_id, receipt, accepted_at, attempts, lease_token, lease_expires_at,
                completed_at, dead_lettered_at
           FROM server_retros
          ORDER BY accepted_at, request_id`,
      )
      .all() as unknown as {
      accepted_at: string;
      attempts: number;
      completed_at: string | null;
      dead_lettered_at: string | null;
      lease_expires_at: number | null;
      lease_token: string | null;
      receipt: string;
      request_id: string;
    }[];
    return rows.map(row => {
      let state: PublicRetroLifecycle['state'] = 'queued';
      if (row.completed_at !== null) state = 'completed';
      else if (row.dead_lettered_at !== null) state = 'dead-lettered';
      else if (
        row.lease_token !== null &&
        row.lease_expires_at !== null &&
        row.lease_expires_at > now
      ) {
        state = 'leased';
      }
      return {
        acceptedAt: row.accepted_at,
        attempts: row.attempts,
        ...(row.completed_at !== null && { completedAt: row.completed_at }),
        ...(row.lease_expires_at !== null && { leaseExpiresAt: row.lease_expires_at }),
        receipt: row.receipt,
        requestId: row.request_id,
        state,
      };
    });
  }

  readServerPayload(requestId: string, principal: 'break-glass'): Uint8Array | undefined {
    this.#database.exec('BEGIN IMMEDIATE;');
    try {
      const stored = this.#database
        .prepare('SELECT raw_body FROM server_retros WHERE request_id = ?')
        .get(requestId) as Pick<StoredServerRetro, 'raw_body'> | undefined;
      if (stored !== undefined) {
        this.#database
          .prepare(
            'INSERT INTO payload_access_audit (request_id, principal, accessed_at) VALUES (?, ?, ?)',
          )
          .run(requestId, principal, new Date(this.#now()).toISOString());
      }
      this.#database.exec('COMMIT;');
      return stored?.raw_body;
    } catch (error) {
      if (this.#database.isTransaction) this.#database.exec('ROLLBACK;');
      throw error;
    }
  }

  release(requestId: string, leaseToken: string): boolean {
    this.#database.exec('BEGIN IMMEDIATE;');
    try {
      const now = this.#now();
      const result = this.#database
        .prepare(
          `UPDATE server_retros
            SET lease_token = NULL, lease_expires_at = NULL,
                next_attempt_at = ?
          WHERE request_id = ? AND lease_token = ? AND lease_expires_at > ?
            AND completed_at IS NULL AND dead_lettered_at IS NULL`,
        )
        .run(now + 60_000, requestId, leaseToken, now);
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

  reject(requestId: string, leaseToken: string): boolean {
    this.#database.exec('BEGIN IMMEDIATE;');
    try {
      const now = this.#now();
      const rejectedAt = new Date(now).toISOString();
      const result = this.#database
        .prepare(
          `UPDATE server_retros
              SET dead_lettered_at = ?, terminal_reason = 'relay_rejected',
                  lease_token = NULL, lease_expires_at = NULL
            WHERE request_id = ? AND lease_token = ? AND lease_expires_at > ?
              AND completed_at IS NULL AND dead_lettered_at IS NULL`,
        )
        .run(rejectedAt, requestId, leaseToken, now);
      if (result.changes === 1) {
        this.#database
          .prepare("DELETE FROM filing_reservations WHERE request_id = ? AND state = 'reserved'")
          .run(requestId);
        this.#database
          .prepare(
            `INSERT INTO operator_alerts (request_id, code, created_at)
             VALUES (?, 'relay_rejected', ?) ON CONFLICT (request_id) DO NOTHING`,
          )
          .run(requestId, rejectedAt);
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
      const now = this.#now();
      const result = this.#database
        .prepare(
          `UPDATE server_retros
            SET completed_at = ?, lease_token = NULL, lease_expires_at = NULL
          WHERE request_id = ? AND lease_token = ? AND lease_expires_at > ?
            AND completed_at IS NULL AND dead_lettered_at IS NULL`,
        )
        .run(new Date(now).toISOString(), requestId, leaseToken, now);
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
