import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { packagedNamespaceRootLabel } from '../../src/commands/codex-hook.js';

describe('packagedNamespaceRootLabel', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories) {
      rmSync(directory, { recursive: true, force: true });
    }
    directories.length = 0;
  });

  it('includes a custom project root in the generated ownership module', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot: 'knowledge' } }),
    );

    expect(packagedNamespaceRootLabel(projectDirectory)).toBe('knowledge');
  });
});
