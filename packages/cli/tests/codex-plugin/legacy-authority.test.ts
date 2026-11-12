import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { legacyCodexEventIsViable } from '../../src/codex-plugin/legacy-authority.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots) removeTemporaryDirectory(root);
  roots.length = 0;
});

/** A project whose legacy Codex config still runs the packaged session hook. */
function legacyPackageHookProject(markers: readonly string[]): {
  cwd: string;
  environment: NodeJS.ProcessEnv;
} {
  const cwd = createTemporaryDirectory();
  roots.push(cwd);
  mkdirSync(nodePath.join(cwd, '.codex'), { recursive: true });
  writeFileSync(
    nodePath.join(cwd, '.codex/config.toml'),
    '[[hooks.SessionStart]]\n[[hooks.SessionStart.hooks]]\ntype = "command"\ncommand = "npx --yes safeword hook codex session-start"\n',
  );
  mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
  for (const marker of markers) writeFileSync(nodePath.join(cwd, marker), 'x\n');
  const bin = nodePath.join(cwd, 'bin');
  mkdirSync(bin);
  writeFileSync(nodePath.join(bin, 'npx'), '#!/bin/sh\n');
  chmodSync(nodePath.join(bin, 'npx'), 0o755);
  return { cwd, environment: { PATH: bin } };
}

describe('legacy Codex package-hook authority', () => {
  it.each([
    ['the dedicated marker', ['.safeword/enrolled'], true],
    ['only the handbook copy an older install left', ['.safeword/SAFEWORD.md'], true],
    ['no enrollment evidence', [], false],
  ])('treats the session hook in a project with %s as viable: %s', (_label, markers, viable) => {
    const { cwd, environment } = legacyPackageHookProject(markers);

    expect(legacyCodexEventIsViable(cwd, 'session-start', environment)).toBe(viable);
  });
});
