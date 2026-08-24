import { randomUUID } from 'node:crypto';
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

export class PublicRetroConflict extends Error {}

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
    `);
  }

  accept(requestId: string, sessionScope: string, rawBody: Uint8Array): AcceptedPublicRetro {
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
        .prepare('SELECT request_id FROM public_retros WHERE session_scope = ?')
        .get(sessionScope) as { request_id: string } | undefined;
      if (scopeOwner !== undefined) {
        throw new PublicRetroConflict('session scope already belongs to another request');
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
