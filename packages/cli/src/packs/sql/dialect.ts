/**
 * SQL dialect auto-detection
 *
 * Detects the correct SQLFluff dialect from project signals.
 * Returns undefined when no signal found (caller defaults to 'ansi').
 */

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import YAML from 'yaml';

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

// Drizzle dialect → SQLFluff dialect
const DRIZZLE_TO_DIALECT: Record<string, string> = {
  postgresql: 'postgres',
  mysql: 'mysql',
  sqlite: 'sqlite',
  turso: 'sqlite',
  singlestore: 'mysql',
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
 *
 * Priority order: profiles.yml (canonical for dbt) → Python deps (always in repo)
 * → sqlc config → Prisma schema → Drizzle config → DATABASE_URL (lowest confidence).
 */
export function detectSqlDialect(cwd: string): string | undefined {
  return (
    detectFromProfiles(cwd) ??
    detectFromPythonDeps(cwd) ??
    detectFromSqlcConfig(cwd) ??
    detectFromPrismaSchema(cwd) ??
    detectFromDrizzleConfig(cwd) ??
    detectFromDatabaseUrl(cwd)
  );
}

/** Read adapter type from a profiles.yml file for the given profile name. */
function resolveProfileType(profilesPath: string, profileName: string): string | undefined {
  if (!existsSync(profilesPath)) return undefined;

  const content = readFileSync(profilesPath, 'utf8');
  const profiles = YAML.parse(content, { schema: 'failsafe' }) as Record<string, unknown>;
  const profile = profiles[profileName] as Record<string, unknown> | undefined;
  if (!profile?.outputs) return undefined;

  const outputs = profile.outputs as Record<string, Record<string, unknown>>;
  const targetName = typeof profile.target === 'string' ? profile.target : Object.keys(outputs)[0];
  if (!targetName) return undefined;

  const target = outputs[targetName];
  return typeof target?.type === 'string' ? target.type : undefined;
}

/** Signal 1: dbt profiles.yml → adapter type field. */
function detectFromProfiles(cwd: string): string | undefined {
  const dbtProjectDirectory = findInTree(cwd, 'dbt_project.yml');
  if (!dbtProjectDirectory) return undefined;

  try {
    const projectContent = readFileSync(
      nodePath.join(dbtProjectDirectory, 'dbt_project.yml'),
      'utf8',
    );
    const project = YAML.parse(projectContent, { schema: 'failsafe' }) as Record<string, unknown>;
    const profileName = project.profile;
    if (typeof profileName !== 'string') return undefined;

    // Search: project root → dbt/ subdir → ~/.dbt/ (dbt's standard fallback)
    const candidates = [
      nodePath.join(dbtProjectDirectory, 'profiles.yml'),
      nodePath.join(dbtProjectDirectory, 'dbt', 'profiles.yml'),
      nodePath.join(process.env.HOME ?? '', '.dbt', 'profiles.yml'),
    ];

    for (const profilesPath of candidates) {
      const adapterType = resolveProfileType(profilesPath, profileName);
      if (adapterType) return ADAPTER_TO_DIALECT[adapterType];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Signal 2: dbt-{adapter} packages in Python dependency files. */
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

/** Signal 3: sqlc config → engine field. */
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

/** Signal 4: Prisma schema.prisma → provider field. */
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

/** Signal 5: drizzle.config.ts → dialect field. */
function detectFromDrizzleConfig(cwd: string): string | undefined {
  for (const filename of ['drizzle.config.ts', 'drizzle.config.js', 'drizzle.config.mjs']) {
    const filePath = nodePath.join(cwd, filename);
    if (!existsSync(filePath)) continue;

    try {
      const content = readFileSync(filePath, 'utf8');
      const match = /dialect\s*:\s*["'](\w+)["']/.exec(content);
      if (match) return DRIZZLE_TO_DIALECT[match[1]];
    } catch {
      continue;
    }
  }
  return undefined;
}

/** Signal 6: DATABASE_URL scheme in .env file. */
function detectFromDatabaseUrl(cwd: string): string | undefined {
  const envPath = nodePath.join(cwd, '.env');
  if (!existsSync(envPath)) return undefined;

  try {
    const content = readFileSync(envPath, 'utf8');
    const match = /DATABASE_URL\s*=\s*["']?(\w+):/.exec(content);
    if (!match) return undefined;

    return SCHEME_TO_DIALECT[match[1]];
  } catch {
    return undefined;
  }
}
