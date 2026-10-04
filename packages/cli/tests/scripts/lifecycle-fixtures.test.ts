import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  changedLifecycleResults,
  isLifecycleFixtureStale,
  lifecycleFixtureTemplatesDigest,
  lifecycleResultDigests,
} from '../../scripts/lib/lifecycle-fixtures.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) removeTemporaryDirectory(directory);
});

function workspace() {
  const root = createTemporaryDirectory();
  temporaryDirectories.push(root);
  const templates = nodePath.join(root, 'templates');
  const fixtures = nodePath.join(root, 'fixtures');
  mkdirSync(nodePath.join(templates, 'guides'), { recursive: true });
  mkdirSync(fixtures);
  writeFileSync(nodePath.join(templates, 'SAFEWORD.md'), '# Safeword\n');
  writeFileSync(nodePath.join(templates, 'guides', 'a.md'), 'guide\n');
  const writeManifest = (templatesSha256?: string): void => {
    writeFileSync(
      nodePath.join(fixtures, 'manifest.json'),
      JSON.stringify({ templatesSha256, fixtures: {} }),
    );
  };
  const writeFixture = (name: string, result: string, tree: string): void => {
    writeFileSync(
      nodePath.join(fixtures, `${name}.json`),
      JSON.stringify({ result_sha256: result, tree_sha256: tree }),
    );
  };
  return { templates, fixtures, writeManifest, writeFixture };
}

describe('lifecycle origin-main fixture staleness (#5312)', () => {
  it('is current when the manifest records the templates digest', () => {
    const { templates, fixtures, writeManifest } = workspace();
    writeManifest(lifecycleFixtureTemplatesDigest(templates));

    expect(isLifecycleFixtureStale(fixtures, templates)).toBe(false);
  });

  it('goes stale after a prose-only template edit', () => {
    const { templates, fixtures, writeManifest } = workspace();
    writeManifest(lifecycleFixtureTemplatesDigest(templates));

    writeFileSync(nodePath.join(templates, 'guides', 'a.md'), 'guide, reworded\n');

    expect(isLifecycleFixtureStale(fixtures, templates)).toBe(true);
  });

  it('goes stale when a template file is added', () => {
    const { templates, fixtures, writeManifest } = workspace();
    writeManifest(lifecycleFixtureTemplatesDigest(templates));

    writeFileSync(nodePath.join(templates, 'guides', 'b.md'), 'new guide\n');

    expect(isLifecycleFixtureStale(fixtures, templates)).toBe(true);
  });

  it('is stale when the manifest predates the digest', () => {
    const { templates, fixtures, writeManifest } = workspace();
    writeManifest();

    expect(isLifecycleFixtureStale(fixtures, templates)).toBe(true);
  });

  it('ignores untracked Finder metadata', () => {
    const { templates, fixtures, writeManifest } = workspace();
    writeManifest(lifecycleFixtureTemplatesDigest(templates));

    writeFileSync(nodePath.join(templates, 'guides', '.DS_Store'), 'finder');

    expect(isLifecycleFixtureStale(fixtures, templates)).toBe(false);
  });
});

describe('lifecycle result drift after regeneration (#5312)', () => {
  it('accepts tree-only drift', () => {
    const { fixtures, writeFixture } = workspace();
    writeFixture('codex-install', 'result-a', 'tree-a');
    const before = lifecycleResultDigests(fixtures);

    writeFixture('codex-install', 'result-a', 'tree-b');

    expect(changedLifecycleResults(before, lifecycleResultDigests(fixtures))).toEqual([]);
  });

  it('names each case whose result moved', () => {
    const { fixtures, writeFixture } = workspace();
    writeFixture('codex-install', 'result-a', 'tree-a');
    writeFixture('cursor-check', 'result-c', 'tree-c');
    const before = lifecycleResultDigests(fixtures);

    writeFixture('codex-install', 'result-b', 'tree-b');
    writeFixture('cursor-check', 'result-c', 'tree-d');

    expect(changedLifecycleResults(before, lifecycleResultDigests(fixtures))).toEqual([
      'codex-install.json',
    ]);
  });
});
