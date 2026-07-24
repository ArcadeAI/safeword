import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  collectExecutableFeatureDirectories,
  findFeatureSourcePath,
} from '../../src/utils/feature-source.js';

const temporaryDirectories: string[] = [];
const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../src/cli.ts');

function makeProject(): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-feature-source-'));
  temporaryDirectories.push(directory);
  return directory;
}

function writeProjectFile(project: string, relativePath: string, content = ''): void {
  const absolutePath = nodePath.join(project, relativePath);
  mkdirSync(nodePath.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { force: true, recursive: true });
  }
  temporaryDirectories.length = 0;
});

describe('findFeatureSourcePath', () => {
  it('uses the same executable feature roots as the Cucumber lane', () => {
    const project = makeProject();
    writeProjectFile(project, 'examples/demo/features/customer-flow.feature');
    writeProjectFile(project, 'packages/app/features/nested/customer-flow.feature');

    const featurePath = findFeatureSourcePath(project, 'BFCWDB-customer-flow');

    expect(featurePath).toBe(
      nodePath.join(project, 'packages/app/features/nested/customer-flow.feature'),
    );
  });

  it('does not treat out-of-policy feature directories as executable source', () => {
    const project = makeProject();
    writeProjectFile(project, 'examples/demo/features/customer-flow.feature');

    const featurePath = findFeatureSourcePath(project, 'BFCWDB-customer-flow');

    expect(featurePath).toBeUndefined();
  });
});

describe('collectExecutableFeatureDirectories', () => {
  it('includes root and workspace feature lanes', () => {
    const project = makeProject();
    mkdirSync(nodePath.join(project, 'packages', 'cli', 'features'), { recursive: true });
    mkdirSync(nodePath.join(project, 'apps', 'web', 'features'), { recursive: true });

    expect(collectExecutableFeatureDirectories(project)).toEqual([
      nodePath.join(project, 'features'),
      nodePath.join(project, 'packages', 'cli', 'features'),
      nodePath.join(project, 'apps', 'web', 'features'),
    ]);
  });

  it('augments default lanes with paths.features', () => {
    const project = makeProject();
    writeProjectFile(
      project,
      '.safeword/config.json',
      JSON.stringify({ paths: { features: 'custom/features' } }),
    );
    mkdirSync(nodePath.join(project, 'custom', 'features'), { recursive: true });

    expect(collectExecutableFeatureDirectories(project)).toEqual([
      nodePath.join(project, 'features'),
      nodePath.join(project, 'custom', 'features'),
    ]);
  });

  it('is wired to the feature-directories CLI command', () => {
    const project = makeProject();
    const resolvedProject = realpathSync(project);
    mkdirSync(nodePath.join(project, 'packages', 'cli', 'features'), { recursive: true });
    writeProjectFile(
      project,
      '.safeword/config.json',
      JSON.stringify({ paths: { features: 'custom/features' } }),
    );
    mkdirSync(nodePath.join(project, 'custom', 'features'), { recursive: true });

    const result = spawnSync('bun', [CLI_PATH, 'feature-directories'], {
      cwd: project,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim().split('\n')).toEqual([
      nodePath.join(resolvedProject, 'features'),
      nodePath.join(resolvedProject, 'packages', 'cli', 'features'),
      nodePath.join(resolvedProject, 'custom', 'features'),
    ]);
  });
});
