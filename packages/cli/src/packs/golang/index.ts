/**
 * Go Language Pack
 *
 * Detects Go projects. Config file (.golangci.yml) is created by schema.
 */

import { existsShallow } from '../../utils/fs.js';
import type { LanguagePack, SetupContext, SetupResult } from '../types.js';
import { setupGoTooling } from './setup.js';

export const golangPack: LanguagePack = {
  id: 'golang',
  name: 'Go',
  extensions: ['.go'],

  detect(cwd: string): boolean {
    return existsShallow(cwd, 'go.mod');
  },

  setup(_cwd: string, _ctx: SetupContext): SetupResult {
    // .golangci.yml is created by schema.ts (managedFiles)
    return setupGoTooling();
  },
};
