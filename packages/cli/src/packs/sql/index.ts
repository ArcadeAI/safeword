/**
 * SQL Language Pack
 *
 * Detects SQL projects (dbt, sqlc, Flyway, etc.) and configures SQLFluff
 * for SQL linting with Jinja-aware parsing.
 */

import { existsInTree } from '../../utils/fs.js';
import type { LanguagePack, SetupContext, SetupResult } from '../types.js';

export const sqlPack: LanguagePack = {
  id: 'sql',
  name: 'SQL',
  extensions: ['.sql'],

  detect(cwd: string): boolean {
    // Phase 1: dbt only (same as before rename)
    // Phase 2 (ticket 057) will add Tier 1/2 signals
    return existsInTree(cwd, 'dbt_project.yml');
  },

  setup(_cwd: string, _ctx: SetupContext): SetupResult {
    // Config files created by schema.ts (ownedFiles/managedFiles)
    return { files: [] };
  },
};
