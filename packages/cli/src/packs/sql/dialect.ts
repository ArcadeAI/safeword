/**
 * SQL dialect auto-detection
 *
 * Detects the correct SQLFluff dialect from project signals.
 * Returns undefined when no signal found (caller defaults to 'ansi').
 */

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { findInTree } from '../../utils/fs.js';

// dbt adapter name → SQLFluff dialect (most are 1:1)
const ADAPTER_TO_DIALECT: Record<string, string> = {
  postgres: 'postgres',
  postgresql: 'postgres',
  redshift: 'redshift',
  snowflake: 'snowflake',
  bigquery: 'bigquery',
  clickhouse: 'clickhouse',
  duckdb: 'duckdb',
  trino: 'trino',
  databricks: 'databricks',
  athena: 'athena',
  teradata: 'teradata',
  materialize: 'materialize',
  sqlite: 'sqlite',
  mysql: 'mysql',
  oracle: 'oracle',
  vertica: 'vertica',
  starrocks: 'starrocks',
  doris: 'doris',
  hive: 'hive',
  impala: 'impala',
  db2: 'db2',
  greenplum: 'greenplum',
  exasol: 'exasol',
  // Name mismatches
  spark: 'sparksql',
  fabric: 'tsql',
  synapse: 'tsql',
  // Compatibility aliases
  tidb: 'mysql',
  singlestore: 'mysql',
  cratedb: 'postgres',
  timescaledb: 'postgres',
};

// URL scheme → SQLFluff dialect
const SCHEME_TO_DIALECT: Record<string, string> = {
  postgresql: 'postgres',
  postgres: 'postgres',
  mysql: 'mysql',
  mariadb: 'mysql',
  sqlite: 'sqlite',
  sqlite3: 'sqlite',
  bigquery: 'bigquery',
  clickhouse: 'clickhouse',
  redshift: 'redshift',
  snowflake: 'snowflake',
  sqlserver: 'tsql',
  mssql: 'tsql',
};

// ORM provider → SQLFluff dialect
const PROVIDER_TO_DIALECT: Record<string, string> = {
  postgresql: 'postgres',
  mysql: 'mysql',
  sqlite: 'sqlite',
  sqlserver: 'tsql',
  cockroachdb: 'postgres',
};

/**
 * Detect SQL dialect from project signals.
 * Returns the SQLFluff dialect string or undefined (→ ansi default).
 */
export function detectSqlDialect(cwd: string): string | undefined {
  return (
    detectFromPythonDeps(cwd) ??
    detectFromSqlcConfig(cwd) ??
    detectFromPrismaSchema(cwd) ??
    detectFromDatabaseUrl(cwd)
  );
}

/** Signal 1: dbt-{adapter} packages in Python dependency files. */
function detectFromPythonDeps(cwd: string): string | undefined {
  const directory = findInTree(cwd, 'requirements.txt') ?? findInTree(cwd, 'pyproject.toml');
  if (!directory) return undefined;

  const requirementsPath = nodePath.join(directory, 'requirements.txt');
  const pyprojectPath = nodePath.join(directory, 'pyproject.toml');

  try {
    let content: string | undefined;
    if (existsSync(requirementsPath)) {
      content = readFileSync(requirementsPath, 'utf8');
    } else if (existsSync(pyprojectPath)) {
      content = readFileSync(pyprojectPath, 'utf8');
    }
    if (!content) return undefined;

    // Match dbt-{adapter} packages, skipping dbt-core (framework, not adapter)
    const matches = [...content.matchAll(/dbt-(\w+)/g)];
    for (const match of matches) {
      if (match[1] === 'core') continue;
      const dialect = ADAPTER_TO_DIALECT[match[1]];
      if (dialect) return dialect;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Signal 2: sqlc config → engine field. */
function detectFromSqlcConfig(cwd: string): string | undefined {
  for (const filename of ['sqlc.yaml', 'sqlc.yml', 'sqlc.json']) {
    const directory = findInTree(cwd, filename);
    if (!directory) continue;

    try {
      const content = readFileSync(nodePath.join(directory, filename), 'utf8');
      const match = /engine['":\s]+(\w+)/.exec(content);
      if (match) return ADAPTER_TO_DIALECT[match[1]] ?? match[1];
    } catch {
      continue;
    }
  }
  return undefined;
}

/** Signal 3: Prisma schema.prisma → provider field. */
function detectFromPrismaSchema(cwd: string): string | undefined {
  const schemaPath = nodePath.join(cwd, 'prisma', 'schema.prisma');
  if (!existsSync(schemaPath)) return undefined;

  try {
    const content = readFileSync(schemaPath, 'utf8');
    const match = /provider\s*=\s*"(\w+)"/.exec(content);
    if (!match) return undefined;

    // Skip non-database providers (e.g., "prisma-client-js")
    return PROVIDER_TO_DIALECT[match[1]];
  } catch {
    return undefined;
  }
}

/** Signal 4: DATABASE_URL scheme in .env file. */
function detectFromDatabaseUrl(cwd: string): string | undefined {
  const envPath = nodePath.join(cwd, '.env');
  if (!existsSync(envPath)) return undefined;

  try {
    const content = readFileSync(envPath, 'utf8');
    const match = /DATABASE_URL\s*=\s*["']?(\w+):\/\//.exec(content);
    if (!match) return undefined;

    return SCHEME_TO_DIALECT[match[1]];
  } catch {
    return undefined;
  }
}
