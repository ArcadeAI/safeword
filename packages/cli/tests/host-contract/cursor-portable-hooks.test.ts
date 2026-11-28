import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { CursorNativeCatalogueActor } from '../helpers/cursor-native-catalogue.js';

it('prepares a versioned portable hook fixture before the native window boundary', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-portable-hooks-'));
  class SourceOnly extends CursorNativeCatalogueActor {
    protected override async prepareHost(): Promise<void> {}
    protected override launchWindow(): Promise<void> {
      return Promise.reject(new Error('PORTABLE_HOOKS_SOURCE_READY'));
    }
  }
  try {
    const actor = new SourceOnly({
      applicationBundle: nodePath.join(root, 'unexecuted-app'),
      profileDirectory: nodePath.join(root, 'owned-profile'),
      extensionsDirectory: nodePath.join(root, 'owned-extensions'),
      runsDirectory: root,
    });
    await expect(actor.prepare('Cursor', '3.29.9', 'IDE', 'portable')).rejects.toThrow(
      'PORTABLE_HOOKS_SOURCE_READY',
    );
    const config = JSON.parse(
      readFileSync(nodePath.join(actor.workspace, '.cursor/hooks.json'), 'utf8'),
    );
    expect(config.version, 'CURSOR_PORTABLE_HOOK_CONFIG_VERSION_MISSING').toBe(1);
    expect(Object.keys(config.hooks).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'afterShellExecution',
      'workspaceOpen',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
