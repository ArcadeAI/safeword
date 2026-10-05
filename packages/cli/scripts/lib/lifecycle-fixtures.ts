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

const LIFECYCLE_CONTRACT = 'tests/lifecycle/origin-main-contract.test.ts';

export interface LifecycleFixtureFailure {
  readonly surface: string;
  readonly fix: string;
  readonly detail: string;
  readonly fixLabel?: string;
}

/**
 * The gate's verdict for this surface. Regenerated result hashes mean lifecycle
 * behavior changed, which --fix must surface rather than silently accept; a
 * template edit should only ever move tree hashes.
 */
export function lifecycleFixtureFailure(
  changedResults: readonly string[],
  fixtureRoot = LIFECYCLE_FIXTURE_ROOT,
  templatesRoot = TEMPLATES_ROOT,
): LifecycleFixtureFailure | undefined {
  if (changedResults.length > 0) {
    return {
      surface: 'Lifecycle origin-main fixtures: result_sha256 changed (behavior change)',
      fix: 'git diff tests/fixtures/lifecycle-origin-main',
      fixLabel: 'Inspect',
      detail: [
        'Regenerated, but these lifecycle results changed, not just the installed tree.',
        'Confirm the behavior change is intended and explain it in the PR before committing:',
        ...changedResults.map(name => `  - ${name}`),
      ].join('\n'),
    };
  }
  if (!isLifecycleFixtureStale(fixtureRoot, templatesRoot)) return undefined;
  return {
    surface: 'Lifecycle origin-main fixtures',
    fix: `SAFEWORD_UPDATE_ORIGIN_MAIN_FIXTURES=1 bun run test ${LIFECYCLE_CONTRACT}`,
    detail:
      'packages/cli/templates/ changed since tests/fixtures/lifecycle-origin-main was generated',
  };
}

/** Run the contract in update mode, verify it, and name every case whose result moved. */
export async function regenerateLifecycleFixtures(
  runContract: (update: boolean) => Promise<unknown>,
  fixtureRoot = LIFECYCLE_FIXTURE_ROOT,
): Promise<string[]> {
  const before = lifecycleResultDigests(fixtureRoot);
  await runContract(true);
  await runContract(false);
  return changedLifecycleResults(before, lifecycleResultDigests(fixtureRoot));
}
