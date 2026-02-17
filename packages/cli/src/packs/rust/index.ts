/**
 * Rust language pack
 *
 * Provides strict Clippy and rustfmt configuration for Rust projects.
 */

import nodePath from 'node:path';

import { exists } from '../../utils/fs.js';
import type { LanguagePack, SetupContext, SetupResult } from '../types.js';
import { setupRustTooling } from './setup.js';

export const rustPack: LanguagePack = {
  id: 'rust',
  name: 'Rust',
  extensions: ['.rs'],

  detect(cwd: string): boolean {
    return exists(nodePath.join(cwd, 'Cargo.toml'));
  },

  setup(cwd: string, _ctx: SetupContext): SetupResult {
    return setupRustTooling(cwd);
  },
};
