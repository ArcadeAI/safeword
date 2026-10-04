/**
 * Digest of every file under packages/cli/templates/, recorded in the lifecycle
 * origin-main fixture manifest. The fixtures' tree hashes move with almost any
 * template edit (#5312); comparing this digest lets the generated-surface gate
 * flag stale fixtures in milliseconds instead of running the vitest contract.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

const TEMPLATES_ROOT = nodePath.resolve(import.meta.dirname, '../../templates');
// Finder litter is never tracked, so it must not make a local digest disagree with CI.
const IGNORED_NAMES = new Set(['.DS_Store']);

export function lifecycleFixtureTemplatesDigest(root = TEMPLATES_ROOT): string {
  const hash = createHash('sha256');
  const visit = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true })
      .filter(entry => !IGNORED_NAMES.has(entry.name))
      .toSorted((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = nodePath.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
        continue;
      }
      hash.update(JSON.stringify(nodePath.relative(root, path).split(nodePath.sep).join('/')));
      hash.update(readFileSync(path));
    }
  };
  visit(root);
  return hash.digest('hex');
}
