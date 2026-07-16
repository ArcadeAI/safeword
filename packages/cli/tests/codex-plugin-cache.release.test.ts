import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import * as cacheContract from './helpers/codex-plugin-cache.js';

const CLI_ROOT = nodePath.resolve(import.meta.dirname, '..');
const PLUGIN_ROOT = nodePath.join(CLI_ROOT, 'codex-plugin');

describe('Codex cached plugin contract', () => {
  it('rejects a missing cache asset even when a project copy is present', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-cache-'));
    const codexHome = nodePath.join(fixture, 'home');
    const installedPath = nodePath.join(codexHome, 'plugins/cache/safeword/safeword/0.68.0');
    const projectCopy = nodePath.join(
      fixture,
      'project/.agents/skills/bdd/references/DISCOVERY.md',
    );
    try {
      cpSync(PLUGIN_ROOT, installedPath, { recursive: true });
      mkdirSync(nodePath.dirname(projectCopy), { recursive: true });
      cpSync(nodePath.join(installedPath, 'skills/bdd/references/DISCOVERY.md'), projectCopy);

      expect(() => {
        cacheContract.assertCachedCodexPlugin(CLI_ROOT, codexHome, installedPath);
      }).not.toThrow();

      rmSync(nodePath.join(installedPath, 'skills/bdd/references/DISCOVERY.md'));
      expect(() => {
        cacheContract.assertCachedCodexPlugin(CLI_ROOT, codexHome, installedPath);
      }).toThrow('missing expected asset');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('requires an installed path to be a non-symlink descendant of Codex cache', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-cache-'));
    const codexHome = nodePath.join(fixture, 'home');
    const cacheRoot = nodePath.join(codexHome, 'plugins/cache');
    const installedPath = nodePath.join(cacheRoot, 'safeword/safeword/0.68.0');
    try {
      cpSync(PLUGIN_ROOT, installedPath, { recursive: true });
      expect(
        cacheContract.parsePluginInstalledPath(
          JSON.stringify({ pluginId: 'safeword@safeword', installedPath }),
        ),
      ).toBe(installedPath);

      const linkedPath = nodePath.join(cacheRoot, 'linked-plugin');
      symlinkSync(PLUGIN_ROOT, linkedPath, 'dir');
      expect(() => {
        cacheContract.assertCachedCodexPlugin(CLI_ROOT, codexHome, linkedPath);
      }).toThrow('not a real cache directory');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
