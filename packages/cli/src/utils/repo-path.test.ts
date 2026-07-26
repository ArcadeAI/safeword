import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { toRepoDirectory, toRepoPath } from './repo-path.js';

describe('toRepoPath', () => {
  it('normalizes a Windows-relative path to the forward-slashed anchor grammar', () => {
    const windowsPath = nodePath.win32.join('.project', 'tickets', 'ZZTEST-fixture');

    expect(toRepoPath(windowsPath)).toBe('.project/tickets/ZZTEST-fixture');
  });
});

describe('toRepoDirectory', () => {
  it('normalizes dot segments and duplicate separators before Git path matching', () => {
    expect(toRepoDirectory('/repo', 'shadow/../.project//')).toBe('.project');
  });
});
