import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { hasSafewordProjectMarker as cliHasMarker } from '../src/utils/configured-paths.js';
import { hasSafewordProjectMarker as hookHasMarker } from '../templates/hooks/lib/namespace-root.js';
import { findProjectDir as findEnrolledProject } from '../templates/hooks/lib/safeword-context.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from './helpers.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots) removeTemporaryDirectory(root);
  roots.length = 0;
});

function project(files: readonly string[]): string {
  const root = createTemporaryDirectory();
  roots.push(root);
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  for (const file of files) writeFileSync(nodePath.join(root, file), 'x\n');
  return root;
}

describe('Safeword project enrollment', () => {
  it.each([
    ['the dedicated marker', ['.safeword/enrolled'], true],
    ['only the handbook copy an older install left', ['.safeword/SAFEWORD.md'], true],
    ['neither file', [], false],
  ])('treats a project with %s as enrolled: %s', (_label, files, enrolled) => {
    const root = project(files);
    const nested = nodePath.join(root, 'packages/app');
    mkdirSync(nested, { recursive: true });

    expect(cliHasMarker(root)).toBe(enrolled);
    expect(hookHasMarker(root)).toBe(enrolled);
    // eslint-disable-next-line unicorn/no-null -- the hook API returns null when none is found
    expect(findEnrolledProject(nested)).toBe(enrolled ? root : null);
  });
});
