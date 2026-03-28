/**
 * Unit Tests: SQL dialect auto-detection
 *
 * Tests for detectSqlDialect() signal chain.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectSqlDialect } from '../../src/packs/sql/dialect.js';
import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from '../helpers';

let projectDirectory: string;

beforeEach(() => {
  projectDirectory = createTemporaryDirectory();
});

afterEach(() => {
  if (projectDirectory) {
    removeTemporaryDirectory(projectDirectory);
  }
});

describe('detectSqlDialect', () => {
  // =========================================================================
  // Signal 1: dbt adapter from Python deps
  // =========================================================================

  it('detects postgres from requirements.txt dbt-postgres', () => {
    writeTestFile(projectDirectory, 'requirements.txt', 'dbt-core==1.8.0\ndbt-postgres==1.8.0\n');
    expect(detectSqlDialect(projectDirectory)).toBe('postgres');
  });

  it('detects snowflake from pyproject.toml dbt-snowflake', () => {
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      '[project]\ndependencies = ["dbt-snowflake>=1.7"]\n',
    );
    expect(detectSqlDialect(projectDirectory)).toBe('snowflake');
  });

  it('detects bigquery from dbt-bigquery', () => {
    writeTestFile(projectDirectory, 'requirements.txt', 'dbt-bigquery==1.8.0\n');
    expect(detectSqlDialect(projectDirectory)).toBe('bigquery');
  });

  it('maps spark adapter to sparksql dialect', () => {
    writeTestFile(projectDirectory, 'requirements.txt', 'dbt-spark==1.8.0\n');
    expect(detectSqlDialect(projectDirectory)).toBe('sparksql');
  });

  it('maps fabric adapter to tsql dialect', () => {
    writeTestFile(projectDirectory, 'requirements.txt', 'dbt-fabric==1.8.0\n');
    expect(detectSqlDialect(projectDirectory)).toBe('tsql');
  });

  it('returns undefined for unknown dbt adapter', () => {
    writeTestFile(projectDirectory, 'requirements.txt', 'dbt-firebolt==1.0.0\n');
    expect(detectSqlDialect(projectDirectory)).toBeUndefined();
  });

  // =========================================================================
  // Signal 2: sqlc config
  // =========================================================================

  it('detects postgres from sqlc.yaml engine', () => {
    writeTestFile(
      projectDirectory,
      'sqlc.yaml',
      'version: 2\nsql:\n  - engine: postgresql\n    queries: query.sql\n',
    );
    expect(detectSqlDialect(projectDirectory)).toBe('postgres');
  });

  it('detects mysql from sqlc.json engine', () => {
    writeTestFile(
      projectDirectory,
      'sqlc.json',
      '{"version": "2", "sql": [{"engine": "mysql"}]}\n',
    );
    expect(detectSqlDialect(projectDirectory)).toBe('mysql');
  });

  // =========================================================================
  // Signal 3: Prisma schema
  // =========================================================================

  it('detects postgres from prisma schema provider', () => {
    writeTestFile(
      projectDirectory,
      'prisma/schema.prisma',
      'datasource db {\n  provider = "postgresql"\n  url = env("DATABASE_URL")\n}\n',
    );
    expect(detectSqlDialect(projectDirectory)).toBe('postgres');
  });

  it('detects mysql from prisma schema provider', () => {
    writeTestFile(
      projectDirectory,
      'prisma/schema.prisma',
      'datasource db {\n  provider = "mysql"\n  url = env("DATABASE_URL")\n}\n',
    );
    expect(detectSqlDialect(projectDirectory)).toBe('mysql');
  });

  it('detects tsql from prisma sqlserver provider', () => {
    writeTestFile(
      projectDirectory,
      'prisma/schema.prisma',
      'datasource db {\n  provider = "sqlserver"\n  url = env("DATABASE_URL")\n}\n',
    );
    expect(detectSqlDialect(projectDirectory)).toBe('tsql');
  });

  // =========================================================================
  // Signal 4: DATABASE_URL
  // =========================================================================

  it('detects postgres from DATABASE_URL scheme', () => {
    writeTestFile(projectDirectory, '.env', 'DATABASE_URL=postgresql://localhost/mydb\n');
    expect(detectSqlDialect(projectDirectory)).toBe('postgres');
  });

  it('detects mysql from DATABASE_URL scheme', () => {
    writeTestFile(projectDirectory, '.env', 'DATABASE_URL="mysql://localhost/mydb"\n');
    expect(detectSqlDialect(projectDirectory)).toBe('mysql');
  });

  it('detects clickhouse from DATABASE_URL scheme', () => {
    writeTestFile(projectDirectory, '.env', "DATABASE_URL='clickhouse://localhost/mydb'\n");
    expect(detectSqlDialect(projectDirectory)).toBe('clickhouse');
  });

  // =========================================================================
  // Priority ordering
  // =========================================================================

  it('Python deps take priority over DATABASE_URL', () => {
    writeTestFile(projectDirectory, 'requirements.txt', 'dbt-snowflake==1.8.0\n');
    writeTestFile(projectDirectory, '.env', 'DATABASE_URL=postgresql://localhost/mydb\n');
    expect(detectSqlDialect(projectDirectory)).toBe('snowflake');
  });

  // =========================================================================
  // No signals
  // =========================================================================

  it('returns undefined when no signals found', () => {
    expect(detectSqlDialect(projectDirectory)).toBeUndefined();
  });

  it('returns undefined for project with only dbt_project.yml (no deps)', () => {
    writeTestFile(projectDirectory, 'dbt_project.yml', 'name: test\nprofile: test\n');
    expect(detectSqlDialect(projectDirectory)).toBeUndefined();
  });
});
