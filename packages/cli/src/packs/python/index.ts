/**
 * Python Language Pack
 *
 * Wraps existing setup.ts functionality in the LanguagePack interface.
 */

import { existsShallow } from '../../utils/fs.js';
import type { LanguagePack, SetupContext, SetupResult } from '../types.js';
import { setupPythonTooling } from './setup.js';

export const pythonPack: LanguagePack = {
  id: 'python',
  name: 'Python',
  extensions: ['.py', '.pyi'],

  detect(cwd: string): boolean {
    return existsShallow(cwd, 'pyproject.toml');
  },

  setup(_cwd: string, _ctx: SetupContext): SetupResult {
    // Config files created by schema.ts (ownedFiles/managedFiles)
    return setupPythonTooling();
  },
};
