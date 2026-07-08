import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && path.endsWith('.ts') ? [path] : [];
  });
}

describe('Node 22 runtime contract', () => {
  it('does not call Node 24-only Error.isError in runtime source', () => {
    const sourceRoot = nodePath.join(process.cwd(), 'src');
    const offenders = sourceFiles(sourceRoot)
      .filter(path => readFileSync(path, 'utf8').includes('Error.isError('))
      .map(path => nodePath.relative(process.cwd(), path));

    expect(offenders).toEqual([]);
  });
});
