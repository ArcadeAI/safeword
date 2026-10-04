/**
 * Staleness checks for the lifecycle origin-main fixtures. Their tree hashes
 * move with almost any template edit (#5312), so the manifest records the
 * templates digest it was generated from; the generated-surface gate compares
 * it in milliseconds instead of running the vitest contract.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

const TEMPLATES_ROOT = nodePath.resolve(import.meta.dirname, '../../templates');
export const LIFECYCLE_FIXTURE_ROOT = nodePath.resolve(
  import.meta.dirname,
  '../../tests/fixtures/lifecycle-origin-main',
);
// Finder litter is never tracked, so it must not make a local digest disagree with CI.
const IGNORED_NAMES = new Set(['.DS_Store']);

// Code-unit order, not localeCompare: the digest is compared across machines.
function byName(left: { name: string }, right: { name: string }): number {
  if (left.name < right.name) return -1;
  return left.name > right.name ? 1 : 0;
}

export function lifecycleFixtureTemplatesDigest(root = TEMPLATES_ROOT): string {
  const hash = createHash('sha256');
  const visit = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true })
      .filter(entry => !IGNORED_NAMES.has(entry.name))
      .toSorted(byName);
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

export function isLifecycleFixtureStale(
  fixtureRoot = LIFECYCLE_FIXTURE_ROOT,
  templatesRoot = TEMPLATES_ROOT,
): boolean {
  const manifest = JSON.parse(
    readFileSync(nodePath.join(fixtureRoot, 'manifest.json'), 'utf8'),
  ) as { readonly templatesSha256?: string };
  return manifest.templatesSha256 !== lifecycleFixtureTemplatesDigest(templatesRoot);
}

/** Behavior digests per contract case; these must not move with a template edit. */
export function lifecycleResultDigests(
  fixtureRoot = LIFECYCLE_FIXTURE_ROOT,
): Record<string, string> {
  return Object.fromEntries(
    readdirSync(fixtureRoot)
      .filter(name => name.endsWith('.json') && name !== 'manifest.json')
      .map(name => {
        const fixture = JSON.parse(readFileSync(nodePath.join(fixtureRoot, name), 'utf8')) as {
          readonly result_sha256: string;
        };
        return [name, fixture.result_sha256];
      }),
  );
}

export function changedLifecycleResults(
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
): string[] {
  return Object.keys(after)
    .filter(name => before[name] !== after[name])
    .toSorted((left, right) => left.localeCompare(right));
}
