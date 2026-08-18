/**
 * SQL-specific Setup Utilities
 *
 * Setup logic for SQL projects. Config generators are in files.ts and dialect
 * auto-detection is in dialect.ts (same pattern as the other language packs).
 *
 * Note: `.sqlfluff` configs are created by the schema system (ownedFiles and
 * managedFiles). This function exists for shape parity with the other packs and
 * future SQL-specific setup.
 *
 * @returns Empty result (schema handles file creation)
 */

import type { SetupResult } from '../types.js';

export function setupSqlTooling(): SetupResult {
  // Config files created by schema.ts ownedFiles/managedFiles
  // Future: Add SQL-specific setup logic here
  return { files: [] };
}
