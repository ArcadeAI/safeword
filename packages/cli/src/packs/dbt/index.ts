/**
 * dbt Language Pack
 *
 * Detects dbt projects (dbt_project.yml) and configures SQLFluff
 * for SQL linting with Jinja-aware parsing.
 */

import nodePath from 'node:path';

import { exists } from '../../utils/fs.js';
import type { LanguagePack, SetupContext, SetupResult } from '../types.js';

export const dbtPack: LanguagePack = {
  id: 'dbt',
  name: 'dbt',
  extensions: ['.sql'],

  detect(cwd: string): boolean {
    return exists(nodePath.join(cwd, 'dbt_project.yml'));
  },

  setup(_cwd: string, _ctx: SetupContext): SetupResult {
    // Config files created by schema.ts (ownedFiles/managedFiles)
    return { files: [] };
  },
};
