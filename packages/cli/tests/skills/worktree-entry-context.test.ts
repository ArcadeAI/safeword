import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const readRepoFile = (relativePath: string): string =>
  readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');

describe('worktree entry context', () => {
  it.each([
    ['canonical SAFEWORD template', 'packages/cli/templates/SAFEWORD.md'],
    ['dogfood SAFEWORD copy', '.safeword/SAFEWORD.md'],
  ])('%s orients every host before project path probes', (_label, path) => {
    const content = readRepoFile(path);

    expect(content).toContain('**Worktree entry (all hosts).**');
    expect(content).toContain('At session start');
    expect(content).toContain('run `pwd &&');
    expect(content).toContain('git rev-parse --show-toplevel');
    expect(content).toContain('git branch --show-current');
    expect(content).toContain('git rev-parse --short HEAD');
    expect(content).toContain('Do not guess a package directory or probe a speculative path');
    expect(content).toContain('<namespace-root>/architecture.generated.md');
    expect(content).not.toContain('**Root moves (Cursor).**');
  });
});
