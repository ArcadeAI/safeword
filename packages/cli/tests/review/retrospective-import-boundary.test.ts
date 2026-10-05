import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

const sourceRoot = nodePath.resolve(import.meta.dirname, '../../src');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

it('keeps the cutoff override mechanism behind the pinned production entry point', () => {
  const importers = sourceFiles(sourceRoot)
    .filter(path => readFileSync(path, 'utf8').includes('retrospective-history-core.js'))
    .map(path => nodePath.relative(sourceRoot, path));
  expect(importers).toEqual([nodePath.join('review', 'retrospective-history.ts')]);
});
