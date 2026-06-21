import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { findFeatureSourcePath } from '../../src/utils/feature-source.js';

const temporaryDirectories: string[] = [];

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
