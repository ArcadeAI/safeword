import { createRequire } from 'node:module';
import type {
  DatabaseSync as NodeDatabaseSync,
  SQLInputValue,
  StatementResultingChanges,
  StatementSync,
} from 'node:sqlite';

// tsup strips `node:` from static built-in imports, but SQLite has no bare
// `sqlite` alias. Keeping the specifier in require() preserves the runtime API.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
  DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => NodeDatabaseSync;
};

function normalizeRow(row: Record<string, unknown>): Record<string, unknown>;
function normalizeRow(
  row: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined;
function normalizeRow(
  row: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (row === undefined) return undefined;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Uint8Array && !Buffer.isBuffer(value) ? Buffer.from(value) : value,
    ]),
  );
}

class Statement<Bindings extends SQLInputValue[], Result extends object> {
  readonly #statement: StatementSync;

  constructor(statement: StatementSync) {
    this.#statement = statement;
  }

  all(...bindings: Bindings): Result[] {
    return this.#statement.all(...bindings).map(row => normalizeRow(row)) as Result[];
  }

  get(...bindings: Bindings): Result | undefined {
    return normalizeRow(this.#statement.get(...bindings)) as Result | undefined;
  }

  run(...bindings: Bindings): { changes: number; lastInsertRowid: number } {
    const result: StatementResultingChanges = this.#statement.run(...bindings);
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }
}

export default class Database {
  readonly #database: NodeDatabaseSync;

  constructor(path: string, options: { readonly?: boolean; timeout?: number } = {}) {
    this.#database = new DatabaseSync(path, { readOnly: options.readonly });
    if (options.timeout !== undefined) {
      this.#database.exec(`PRAGMA busy_timeout = ${options.timeout};`);
    }
  }

  close(): void {
    this.#database.close();
  }

  exec(sql: string): void {
    this.#database.exec(sql);
  }

  pragma(command: string, options: { simple?: boolean } = {}): unknown {
    const row = this.#database.prepare(`PRAGMA ${command}`).get();
    if (options.simple === true) return row === undefined ? undefined : Object.values(row)[0];
    return row;
  }

  prepare<
    Bindings extends SQLInputValue[] = SQLInputValue[],
    Result extends object = Record<string, unknown>,
  >(sql: string): Statement<Bindings, Result> {
    return new Statement<Bindings, Result>(this.#database.prepare(sql));
  }

  transaction<Result>(operation: () => Result): (() => Result) & { immediate: () => Result } {
    const execute = (mode: 'DEFERRED' | 'IMMEDIATE'): Result => {
      this.#database.exec(`BEGIN ${mode};`);
      try {
        const result = operation();
        this.#database.exec('COMMIT;');
        return result;
      } catch (error) {
        this.#database.exec('ROLLBACK;');
        throw error;
      }
    };
    return Object.assign(() => execute('DEFERRED'), {
      immediate: () => execute('IMMEDIATE'),
    });
  }
}
