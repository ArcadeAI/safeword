import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  assertClaudePluginCatalogue,
  generateClaudePluginAssets,
  sealClaudePluginCatalogue,
} from '../../src/claude-plugin/catalogue.js';
import { schemaForClaudeDelivery } from '../../src/claude-plugin/delivery-schema.js';
import { writeClaudePluginMode } from '../../src/claude-plugin/migration-state.js';

const roots: string[] = [];
const digest = 'a'.repeat(64);
const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('Claude delivery schema', () => {
  it('generates and seals one canonical native plugin inventory', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-native-catalogue-'));
    roots.push(root);
    const input = {
      cliBundle: 'export {};\n',
      sourceRoot: nodePath.join(REPO_ROOT, 'packages/cli/src'),
      templatesRoot: nodePath.join(REPO_ROOT, 'packages/cli/templates'),
      version: '0.73.0',
    };
    for (const asset of generateClaudePluginAssets(input)) {
      const target = nodePath.join(root, asset.relativePath);
      mkdirSync(nodePath.dirname(target), { recursive: true });
      writeFileSync(target, asset.content);
    }

    sealClaudePluginCatalogue(root, input.version);

    expect(() => {
      assertClaudePluginCatalogue(input, root);
    }).not.toThrow();
  });

  it('does not recreate Claude legacy delivery after automatic v2 migration', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-native-schema-'));
    roots.push(root);
    writeClaudePluginMode(root, {
      schema_version: 2,
      state: 'clean',
      plugin_version: '0.73.0',
      hook_manifest_sha256: digest,
      catalogue_sha256: digest,
      unresolved_paths: [],
    });
    const schema = schemaForClaudeDelivery(root);
    expect(Object.keys(schema.ownedFiles).some(path => path.startsWith('.claude/'))).toBe(false);
    expect(Object.keys(schema.managedFiles).some(path => path.startsWith('.claude/'))).toBe(false);
  });

  it('does not mistake an unrelated third-party hook for legacy Safeword delivery', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-third-party-schema-'));
    roots.push(root);
    const settings = nodePath.join(root, '.claude/settings.json');
    mkdirSync(nodePath.dirname(settings), { recursive: true });
    writeFileSync(
      settings,
      JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ command: 'bun vendor.ts' }] }] } }),
    );
    const schema = schemaForClaudeDelivery(root);
    expect(Object.keys(schema.ownedFiles).some(path => path.startsWith('.claude/'))).toBe(false);
  });
});
