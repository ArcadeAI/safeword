/**
 * The root-owned dependency-cruiser boundary config.
 *
 * Both the leaf shape-fingerprint (architecture-fingerprint) and the root-index
 * fingerprint (architecture-monorepo) hash this config, so they must agree on
 * which file is canonical and how it's read — sharing one reader removes the
 * silent-desync hazard of two hand-kept copies.
 */

import nodePath from 'node:path';

import { readFileSafe } from './fs.js';

/** Candidate dependency-cruiser config filenames, in resolution order. */
const DEPENDENCY_CRUISER_CONFIG_NAMES = [
  '.dependency-cruiser.cjs',
  '.dependency-cruiser.js',
  '.dependency-cruiser.mjs',
  '.dependency-cruiser.json',
];

/** Content of the first present dependency-cruiser config, or '' when none exists. */
export function readBoundaryConfig(projectDirectory: string): string {
  for (const name of DEPENDENCY_CRUISER_CONFIG_NAMES) {
    const content = readFileSafe(nodePath.join(projectDirectory, name));
    if (content !== undefined) return content;
  }
  return '';
}
