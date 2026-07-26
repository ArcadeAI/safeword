import Database from 'better-sqlite3';

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
      SELECT 1
      WHERE NOT EXISTS (SELECT 1 FROM schema_version);
    `);
    return new RelayStore(database);
  }

  readonly #database: Database.Database;

  private constructor(database: Database.Database) {
    this.#database = database;
  }

  journalMode(): string {
    return this.#database.pragma('journal_mode', { simple: true }) as string;
  }

  schemaVersion(): number {
    const row = this.#database
      .prepare<[], { version: number }>('SELECT version FROM schema_version')
      .get();
    if (row === undefined) {
      throw new Error('schema version row is missing');
    }
    return row.version;
  }

  close(): void {
    this.#database.close();
  }
}
