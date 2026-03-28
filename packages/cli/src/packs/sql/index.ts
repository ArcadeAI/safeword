/**
 * SQL Language Pack
 *
 * Detects SQL projects (dbt, sqlc, Flyway, Atlas, Prisma, Drizzle, etc.)
 * and configures SQLFluff for SQL linting with Jinja-aware parsing.
 */

import { existsSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { existsInTree } from '../../utils/fs.js';
import type { LanguagePack, SetupContext, SetupResult } from '../types.js';

// Tier 1: Config file markers that unambiguously indicate SQL work
const TIER1_MARKERS = [
  'dbt_project.yml',
  '.sqlfluff',
  'sqlc.yaml',
  'sqlc.yml',
  'sqlc.json',
  'flyway.toml',
  'flyway.conf',
  'atlas.hcl',
  'liquibase.properties',
  'schemachange-config.yml',
];

// Tier 2: Directories that indicate SQL work when they contain .sql files
const TIER2_DIRECTORIES = ['prisma/migrations', 'drizzle', 'db/migrations'];

/** Check if a directory exists and contains at least one .sql file. */
function directoryHasSqlFiles(directory: string): boolean {
  if (!existsSync(directory)) return false;
  try {
    return readdirSync(directory).some(f => f.endsWith('.sql'));
  } catch {
    return false;
  }
}

export const sqlPack: LanguagePack = {
  id: 'sql',
  name: 'SQL',
  extensions: ['.sql'],

  detect(cwd: string): boolean {
    // Tier 1: config file markers (high confidence)
    for (const marker of TIER1_MARKERS) {
      if (existsInTree(cwd, marker)) return true;
    }

    // Tier 2: directory conventions with .sql files
    for (const directory of TIER2_DIRECTORIES) {
      if (directoryHasSqlFiles(nodePath.join(cwd, directory))) return true;
    }

    return false;
  },

  setup(_cwd: string, _ctx: SetupContext): SetupResult {
    // Config files created by schema.ts (ownedFiles/managedFiles)
    return { files: [] };
  },
};
