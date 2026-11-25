import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { writeClaudePluginMode } from '../../src/claude-plugin/migration-state.js';
import { projectLifecycleSchema } from '../../src/lifecycle/schema.js';
import { reconcile } from '../../src/reconcile.js';
import { createProjectContext } from '../../src/utils/context.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';
import { useIsolatedClaudePluginState } from '../helpers/claude-plugin-state.js';

useIsolatedClaudePluginState();

const HANDBOOK = '.safeword/SAFEWORD.md';
const MARKER = '.safeword/enrolled';
const roots: string[] = [];

afterEach(() => {
  for (const root of roots) removeTemporaryDirectory(root);
  roots.length = 0;
});

function enrolledProject(): string {
  const cwd = createTemporaryDirectory();
  roots.push(cwd);
  writeFileSync(nodePath.join(cwd, 'package.json'), '{"name":"handbook-fixture"}\n');
  mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(cwd, HANDBOOK), '# Handbook copy from an older release\n');
  return cwd;
}

function markClaudePluginMode(cwd: string): void {
  writeClaudePluginMode(cwd, {
    schema_version: 2,
    state: 'clean',
    plugin_version: '0.0.0-characterization',
    hook_manifest_sha256: 'a'.repeat(64),
    catalogue_sha256: 'b'.repeat(64),
    unresolved_paths: [],
  });
}

describe('project handbook copy after the move to the Claude plugin', () => {
  it('writes the enrollment marker and removes the stale handbook copy on upgrade', async () => {
    const cwd = enrolledProject();
    markClaudePluginMode(cwd);

    await reconcile(
      projectLifecycleSchema(cwd, ['claude'], 'install'),
      'upgrade',
      createProjectContext(cwd),
    );

    expect(existsSync(nodePath.join(cwd, HANDBOOK))).toBe(false);
    expect(readFileSync(nodePath.join(cwd, MARKER), 'utf8')).toContain('enrolled in Safeword');
  });

  it('keeps the handbook copy for a legacy project-hook Claude install', () => {
    const cwd = enrolledProject();
    const settings = nodePath.join(cwd, '.claude/settings.json');
    mkdirSync(nodePath.dirname(settings), { recursive: true });
    writeFileSync(settings, '{ retained legacy configuration');

    const schema = projectLifecycleSchema(cwd, ['claude']);

    expect(schema.ownedFiles[HANDBOOK]).toEqual({ template: 'SAFEWORD.md' });
    expect(schema.ownedFiles[MARKER]).toBeDefined();
    expect(schema.deprecatedFiles).not.toContain(HANDBOOK);
  });

  it('keeps the handbook copy while installed Cursor rules still read it', () => {
    const cwd = enrolledProject();
    markClaudePluginMode(cwd);
    const cursorRule = nodePath.join(cwd, '.cursor/rules/safeword-core.mdc');
    mkdirSync(nodePath.dirname(cursorRule), { recursive: true });
    writeFileSync(cursorRule, '# Safeword core\n');

    const schema = projectLifecycleSchema(cwd, ['claude']);

    expect(schema.ownedFiles[HANDBOOK]).toBeDefined();
    expect(schema.deprecatedFiles).not.toContain(HANDBOOK);
  });

  it('leaves uninstall planning to the owned-file contract', () => {
    const cwd = enrolledProject();
    markClaudePluginMode(cwd);

    expect(projectLifecycleSchema(cwd, ['claude'], 'uninstall').deprecatedFiles).not.toContain(
      HANDBOOK,
    );
  });
});
