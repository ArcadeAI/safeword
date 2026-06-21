/**
 * Unit Tests: SQL dialect auto-detection
 *
 * Tests for detectSqlDialect() signal chain.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectSqlDialect } from '../../src/packs/sql/dialect.js';
import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from '../helpers';

const state: { projectDirectory: string } = { projectDirectory: '' };

beforeEach(() => {
  state.projectDirectory = createTemporaryDirectory();
});

afterEach(() => {
  if (state.projectDirectory) {
    removeTemporaryDirectory(state.projectDirectory);
  }
});

describe('detectSqlDialect', () => {
  // =========================================================================
  // Signal 1: dbt profiles.yml
  // =========================================================================

  it('detects postgres from profiles.yml type field', () => {
    writeTestFile(
      state.projectDirectory,
      'dbt_project.yml',
      'name: my_project\nprofile: my_project\n',
    );
    writeTestFile(
      state.projectDirectory,
      'profiles.yml',
      'my_project:\n  target: dev\n  outputs:\n    dev:\n      type: postgres\n      host: localhost\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('postgres');
  });

  it('detects snowflake from profiles.yml type field', () => {
    writeTestFile(
      state.projectDirectory,
      'dbt_project.yml',
      'name: analytics\nprofile: analytics\n',
    );
    writeTestFile(
      state.projectDirectory,
      'profiles.yml',
      'analytics:\n  target: prod\n  outputs:\n    prod:\n      type: snowflake\n      account: xy12345\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('snowflake');
  });

  it('matches profile name from dbt_project.yml (ignores other profiles)', () => {
    writeTestFile(
      state.projectDirectory,
      'dbt_project.yml',
      'name: my_project\nprofile: my_project\n',
    );
    writeTestFile(
      state.projectDirectory,
      'profiles.yml',
      'other_project:\n  target: dev\n  outputs:\n    dev:\n      type: bigquery\nmy_project:\n  target: dev\n  outputs:\n    dev:\n      type: redshift\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('redshift');
  });

  it('falls back to first output when target is missing', () => {
    writeTestFile(state.projectDirectory, 'dbt_project.yml', 'name: test\nprofile: test\n');
    writeTestFile(
      state.projectDirectory,
      'profiles.yml',
      'test:\n  outputs:\n    dev:\n      type: bigquery\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('bigquery');
  });

  it('checks dbt/ subdir for profiles.yml', () => {
    writeTestFile(state.projectDirectory, 'dbt_project.yml', 'name: mono\nprofile: mono\n');
    writeTestFile(
      state.projectDirectory,
      'dbt/profiles.yml',
      'mono:\n  target: dev\n  outputs:\n    dev:\n      type: clickhouse\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('clickhouse');
  });

  it('returns undefined for unknown adapter type in profiles.yml', () => {
    writeTestFile(state.projectDirectory, 'dbt_project.yml', 'name: test\nprofile: test\n');
    writeTestFile(
      state.projectDirectory,
      'profiles.yml',
      'test:\n  target: dev\n  outputs:\n    dev:\n      type: firebolt\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBeUndefined();
  });

  it('returns undefined when profile name does not match any profile', () => {
    writeTestFile(state.projectDirectory, 'dbt_project.yml', 'name: test\nprofile: my_project\n');
    writeTestFile(
      state.projectDirectory,
      'profiles.yml',
      'other_project:\n  target: dev\n  outputs:\n    dev:\n      type: postgres\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBeUndefined();
  });

  // =========================================================================
  // Signal 2: dbt adapter from Python deps
  // =========================================================================

  it('detects postgres from requirements.txt dbt-postgres', () => {
    writeTestFile(
      state.projectDirectory,
      'requirements.txt',
      'dbt-core==1.8.0\ndbt-postgres==1.8.0\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('postgres');
  });

  it('detects snowflake from pyproject.toml dbt-snowflake', () => {
    writeTestFile(
      state.projectDirectory,
      'pyproject.toml',
      '[project]\ndependencies = ["dbt-snowflake>=1.7"]\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('snowflake');
  });

  it('detects bigquery from dbt-bigquery', () => {
    writeTestFile(state.projectDirectory, 'requirements.txt', 'dbt-bigquery==1.8.0\n');
    expect(detectSqlDialect(state.projectDirectory)).toBe('bigquery');
  });

  it('maps spark adapter to sparksql dialect', () => {
    writeTestFile(state.projectDirectory, 'requirements.txt', 'dbt-spark==1.8.0\n');
    expect(detectSqlDialect(state.projectDirectory)).toBe('sparksql');
  });

  it('maps fabric adapter to tsql dialect', () => {
    writeTestFile(state.projectDirectory, 'requirements.txt', 'dbt-fabric==1.8.0\n');
    expect(detectSqlDialect(state.projectDirectory)).toBe('tsql');
  });

  it('returns undefined for unknown dbt adapter', () => {
    writeTestFile(state.projectDirectory, 'requirements.txt', 'dbt-firebolt==1.0.0\n');
    expect(detectSqlDialect(state.projectDirectory)).toBeUndefined();
  });

  // =========================================================================
  // Signal 3: sqlc config
  // =========================================================================

  it('detects postgres from sqlc.yaml engine', () => {
    writeTestFile(
      state.projectDirectory,
      'sqlc.yaml',
      'version: 2\nsql:\n  - engine: postgresql\n    queries: query.sql\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('postgres');
  });

  it('detects mysql from sqlc.json engine', () => {
    writeTestFile(
      state.projectDirectory,
      'sqlc.json',
      '{"version": "2", "sql": [{"engine": "mysql"}]}\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('mysql');
  });

  // =========================================================================
  // Signal 4: Prisma schema
  // =========================================================================

  it('detects postgres from prisma schema provider', () => {
    writeTestFile(
      state.projectDirectory,
      'prisma/schema.prisma',
      'datasource db {\n  provider = "postgresql"\n  url = env("DATABASE_URL")\n}\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('postgres');
  });

  it('detects mysql from prisma schema provider', () => {
    writeTestFile(
      state.projectDirectory,
      'prisma/schema.prisma',
      'datasource db {\n  provider = "mysql"\n  url = env("DATABASE_URL")\n}\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('mysql');
  });

  it('detects tsql from prisma sqlserver provider', () => {
    writeTestFile(
      state.projectDirectory,
      'prisma/schema.prisma',
      'datasource db {\n  provider = "sqlserver"\n  url = env("DATABASE_URL")\n}\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('tsql');
  });

  // =========================================================================
  // Signal 5: Drizzle config
  // =========================================================================

  it('detects postgres from drizzle.config.ts dialect', () => {
    writeTestFile(
      state.projectDirectory,
      'drizzle.config.ts',
      'import { defineConfig } from "drizzle-kit";\nexport default defineConfig({ dialect: "postgresql", schema: "./src/schema.ts" });\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('postgres');
  });

  it('detects sqlite from drizzle.config.ts turso dialect', () => {
    writeTestFile(
      state.projectDirectory,
      'drizzle.config.ts',
      "export default defineConfig({ dialect: 'turso', schema: './src/schema.ts' });\n",
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('sqlite');
  });

  it('detects tsql from drizzle.config.mjs mssql dialect', () => {
    writeTestFile(
      state.projectDirectory,
      'drizzle.config.mjs',
      'export default defineConfig({ dialect: "mssql" });\n',
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('tsql');
  });

  it('detects mysql from drizzle.config.js singlestore dialect', () => {
    writeTestFile(
      state.projectDirectory,
      'drizzle.config.js',
      "module.exports = { dialect: 'singlestore' };\n",
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('mysql');
  });

  it('detects postgres from drizzle.config.ts gel dialect', () => {
    writeTestFile(
      state.projectDirectory,
      'drizzle.config.ts',
      "export default defineConfig({ dialect: 'gel' });\n",
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('postgres');
  });

  it('detects postgres from drizzle.config.ts cockroach dialect', () => {
    writeTestFile(
      state.projectDirectory,
      'drizzle.config.ts',
      "export default defineConfig({ dialect: 'cockroach' });\n",
    );
    expect(detectSqlDialect(state.projectDirectory)).toBe('postgres');
  });

  it('returns undefined for unknown Drizzle dialect', () => {
    writeTestFile(
      state.projectDirectory,
      'drizzle.config.ts',
      "export default defineConfig({ dialect: 'unknown_db' });\n",
    );
    expect(detectSqlDialect(state.projectDirectory)).toBeUndefined();
  });

  // =========================================================================
  // Signal 6: DATABASE_URL
  // =========================================================================

  it('detects postgres from DATABASE_URL scheme', () => {
    writeTestFile(state.projectDirectory, '.env', 'DATABASE_URL=postgresql://localhost/mydb\n');
    expect(detectSqlDialect(state.projectDirectory)).toBe('postgres');
  });

  it('detects mysql from DATABASE_URL scheme', () => {
    writeTestFile(state.projectDirectory, '.env', 'DATABASE_URL="mysql://localhost/mydb"\n');
    expect(detectSqlDialect(state.projectDirectory)).toBe('mysql');
  });

  it('detects clickhouse from DATABASE_URL scheme', () => {
    writeTestFile(state.projectDirectory, '.env', "DATABASE_URL='clickhouse://localhost/mydb'\n");
    expect(detectSqlDialect(state.projectDirectory)).toBe('clickhouse');
  });

  it('detects sqlite from DATABASE_URL without slashes', () => {
    writeTestFile(state.projectDirectory, '.env', 'DATABASE_URL=sqlite:db/app.sqlite3\n');
    expect(detectSqlDialect(state.projectDirectory)).toBe('sqlite');
  });

  // =========================================================================
  // Priority ordering
  // =========================================================================

  it('profiles.yml takes priority over Python deps', () => {
    writeTestFile(state.projectDirectory, 'dbt_project.yml', 'name: test\nprofile: test\n');
    writeTestFile(
      state.projectDirectory,
      'profiles.yml',
      'test:\n  target: dev\n  outputs:\n    dev:\n      type: snowflake\n',
    );
    writeTestFile(state.projectDirectory, 'requirements.txt', 'dbt-postgres==1.8.0\n');
    expect(detectSqlDialect(state.projectDirectory)).toBe('snowflake');
  });

  it('Python deps take priority over DATABASE_URL', () => {
    writeTestFile(state.projectDirectory, 'requirements.txt', 'dbt-snowflake==1.8.0\n');
    writeTestFile(state.projectDirectory, '.env', 'DATABASE_URL=postgresql://localhost/mydb\n');
    expect(detectSqlDialect(state.projectDirectory)).toBe('snowflake');
  });

  // =========================================================================
  // No signals
  // =========================================================================

  it('returns undefined when no signals found', () => {
    expect(detectSqlDialect(state.projectDirectory)).toBeUndefined();
  });

  it('returns undefined for project with only dbt_project.yml (no deps)', () => {
    writeTestFile(state.projectDirectory, 'dbt_project.yml', 'name: test\nprofile: test\n');
    expect(detectSqlDialect(state.projectDirectory)).toBeUndefined();
  });
});
