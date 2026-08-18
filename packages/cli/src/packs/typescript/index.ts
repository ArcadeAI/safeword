/**
 * TypeScript Language Pack
 *
 * Detects TypeScript/JavaScript projects.
 * Config files (ESLint, Prettier) are created by schema.
 */

import nodePath from 'node:path';

import { exists } from '../../utils/fs.js';
import type { LanguagePack, SetupContext, SetupResult } from '../types.js';
import { setupTypescriptTooling } from './setup.js';
import { typescriptSkillManifest } from './skills.js';

export const typescriptPack: LanguagePack = {
  id: 'typescript',
  name: 'TypeScript',
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  skills: typescriptSkillManifest,

  detect(cwd: string): boolean {
    return exists(nodePath.join(cwd, 'package.json'));
  },

  setup(_cwd: string, _ctx: SetupContext): SetupResult {
    // ESLint/Prettier configs created by schema.ts (ownedFiles/managedFiles)
    return setupTypescriptTooling();
  },
};
