/**
 * dbt-specific Setup Utilities
 *
 * Config generators are in files.ts (same pattern as Python and Go).
 * This file exists for future dbt-specific setup logic.
 */

import type { SetupResult } from '../types.js';

/**
 * Set up dbt tooling configuration.
 *
 * Config files (.sqlfluff, .safeword/sqlfluff.cfg) are created
 * by the schema system (managedFiles/ownedFiles).
 */
export function setupDbtTooling(): SetupResult {
  return { files: [] };
}
