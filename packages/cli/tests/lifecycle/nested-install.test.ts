import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { findEnclosingProject } from '../../src/lifecycle/nested-install.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const temporaryDirectories: string[] = [];

function projectWithSubdirectory(): { root: string; nested: string } {
  const root = createTemporaryDirectory();
  temporaryDirectories.push(root);
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  const nested = nodePath.join(root, 'packages/cli');
  mkdirSync(nested, { recursive: true });
  return { root, nested };
}

afterAll(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
});

describe('enclosing project detection', () => {
  it('reports the installed project above a subdirectory', () => {
    const { root, nested } = projectWithSubdirectory();
    expect(findEnclosingProject(nested)).toBe(root);
  });

  it('ignores the project rooted at the directory itself', () => {
    const { root } = projectWithSubdirectory();
    expect(findEnclosingProject(root)).toBeUndefined();
  });

  it('reports nothing for a directory outside any project', () => {
    const bare = createTemporaryDirectory();
    temporaryDirectories.push(bare);
    const nested = nodePath.join(bare, 'packages/cli');
    mkdirSync(nested, { recursive: true });
    expect(findEnclosingProject(nested)).toBeUndefined();
  });

  it('does not mistake a `.safeword` file for an installed project root', () => {
    const bare = createTemporaryDirectory();
    temporaryDirectories.push(bare);
    const nested = nodePath.join(bare, 'packages/cli');
    mkdirSync(nested, { recursive: true });
    writeFileSync(nodePath.join(bare, '.safeword'), 'not a project');
    expect(findEnclosingProject(nested)).toBeUndefined();
  });
});
