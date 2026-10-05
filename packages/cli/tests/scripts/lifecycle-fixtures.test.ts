import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  changedLifecycleResults,
  isLifecycleFixtureStale,
  LIFECYCLE_FIXTURE_ROOT,
  lifecycleFixtureFailure,
  lifecycleFixtureTemplatesDigest,
  lifecycleResultDigests,
  regenerateLifecycleFixtures,
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

describe('lifecycle fixture failure reported by the gate (#5312)', () => {
  it('reports stale fixtures with the regeneration command', () => {
    const { templates, fixtures, writeManifest } = workspace();
    writeManifest('recorded-before-a-template-edit');

    expect(lifecycleFixtureFailure([], fixtures, templates)).toMatchObject({
      surface: 'Lifecycle origin-main fixtures',
      fix: 'SAFEWORD_UPDATE_ORIGIN_MAIN_FIXTURES=1 bun run test tests/lifecycle/origin-main-contract.test.ts',
    });
  });

  it('reports nothing for current fixtures', () => {
    const { templates, fixtures, writeManifest } = workspace();
    writeManifest(lifecycleFixtureTemplatesDigest(templates));

    expect(lifecycleFixtureFailure([], fixtures, templates)).toBeUndefined();
  });

  it('reports a behavior change naming each moved result, even once fixtures are current', () => {
    const { templates, fixtures, writeManifest } = workspace();
    writeManifest(lifecycleFixtureTemplatesDigest(templates));

    const failure = lifecycleFixtureFailure(['codex-check.json'], fixtures, templates);

    expect(failure?.surface).toBe(
      'Lifecycle origin-main fixtures: result_sha256 changed (behavior change)',
    );
    expect(failure?.detail).toContain('  - codex-check.json');
  });
});

describe('regenerating lifecycle fixtures (#5312)', () => {
  it('updates then verifies the contract and accepts tree-only drift', async () => {
    const { fixtures, writeFixture } = workspace();
    writeFixture('codex-install', 'result-a', 'tree-a');
    const runs: boolean[] = [];

    const changed = await regenerateLifecycleFixtures(update => {
      runs.push(update);
      if (update) writeFixture('codex-install', 'result-a', 'tree-b');
      return Promise.resolve();
    }, fixtures);

    expect(runs).toEqual([true, false]);
    expect(changed).toEqual([]);
  });

  it('names cases whose result moved during regeneration', async () => {
    const { fixtures, writeFixture } = workspace();
    writeFixture('codex-install', 'result-a', 'tree-a');

    const changed = await regenerateLifecycleFixtures(update => {
      if (update) writeFixture('codex-install', 'result-b', 'tree-a');
      return Promise.resolve();
    }, fixtures);

    expect(changed).toEqual(['codex-install.json']);
  });
});

describe('check-generated-surfaces.ts lifecycle surface (#5312)', () => {
  const cliRoot = nodePath.resolve(import.meta.dirname, '../..');

  function runGate(fixtureRoot: string) {
    const result = spawnSync('bun', ['scripts/check-generated-surfaces.ts'], {
      cwd: cliRoot,
      encoding: 'utf8',
      env: { ...process.env, SAFEWORD_LIFECYCLE_FIXTURE_ROOT: fixtureRoot },
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  }

  function copiedFixtures(templatesSha256: string): string {
    const root = createTemporaryDirectory();
    temporaryDirectories.push(root);
    cpSync(LIFECYCLE_FIXTURE_ROOT, root, { recursive: true });
    writeFileSync(
      nodePath.join(root, 'manifest.json'),
      JSON.stringify({ templatesSha256, fixtures: {} }),
    );
    return root;
  }

  it('fails pre-commit when templates changed since the fixtures were generated', () => {
    const gate = runGate(copiedFixtures('recorded-before-a-template-edit'));

    expect(gate.status).not.toBe(0);
    expect(gate.output).toContain('✗ Lifecycle origin-main fixtures');
  });

  it('does not flag fixtures generated from the current templates', () => {
    const gate = runGate(copiedFixtures(lifecycleFixtureTemplatesDigest()));

    expect(gate.output).not.toContain('Lifecycle origin-main fixtures');
  });
});
