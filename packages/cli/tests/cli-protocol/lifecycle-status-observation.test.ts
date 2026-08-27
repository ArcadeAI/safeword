import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { writeClaudePluginMode } from '../../src/claude-plugin/migration-state.js';
import { createResult } from '../../src/cli-protocol/result.js';
import { projectLifecycleSchema } from '../../src/lifecycle/schema.js';
import { observeLifecycleSurfaces, summarizeLifecycleStatus } from '../../src/lifecycle/status.js';
import { isCursorProjectPath, isSharedAgentRuntimePath } from '../../src/schema.js';
import { createTemporaryDirectory } from '../helpers.js';

vi.mock('../../src/claude-plugin/status.js', async () => {
  const { createResult: resultFactory } = await import('../../src/cli-protocol/result.js');
  return {
    observeClaudeStatus: () =>
      resultFactory({
        state: 'healthy',
        data: { command: 'claude status', classification: 'plugin-mode' },
      }),
  };
});

vi.mock('../../src/codex-plugin/operations.js', async () => {
  const { createResult: resultFactory } = await import('../../src/cli-protocol/result.js');
  return {
    observeCodexMigration: () =>
      resultFactory({
        state: 'action_required',
        data: { command: 'codex status', classification: 'activation-pending' },
      }),
  };
});

describe('lifecycle profile observation', () => {
  it('installs the shared proof-identity bridge for a Codex-only project', () => {
    const schema = projectLifecycleSchema(createTemporaryDirectory(), ['codex']);

    expect(schema.ownedFiles['.safeword/hooks/lib/cursor-run-identity.ts']).toEqual({
      template: 'hooks/lib/cursor-run-identity.ts',
    });
  });

  it('drops the shared .safeword hooks|skills|scripts|guides|templates runtime for a Claude-only project', () => {
    const cwd = createTemporaryDirectory();
    writeClaudePluginMode(cwd, {
      schema_version: 2,
      state: 'clean',
      plugin_version: '0.0.0-characterization',
      hook_manifest_sha256: 'a'.repeat(64),
      catalogue_sha256: 'b'.repeat(64),
      unresolved_paths: [],
    });

    const schema = projectLifecycleSchema(cwd, ['claude']);

    const sharedRuntimePaths = [
      ...Object.keys(schema.ownedFiles),
      ...Object.keys(schema.managedFiles),
      ...schema.ownedDirs,
    ].filter(path => isSharedAgentRuntimePath(path));

    expect(sharedRuntimePaths).toEqual([]);
    // Non-runtime .safeword content Claude still reads stays installed.
    expect(schema.ownedFiles['.safeword/config.json']).toBeDefined();
    expect(schema.ownedFiles['.safeword/SAFEWORD.md']).toBeDefined();
  });

  it('keeps the shared runtime while legacy Claude delivery remains observable', () => {
    const cwd = createTemporaryDirectory();
    const settings = nodePath.join(cwd, '.claude/settings.json');
    mkdirSync(nodePath.dirname(settings), { recursive: true });
    writeFileSync(settings, '{ retained legacy configuration');

    const schema = projectLifecycleSchema(cwd, ['claude']);

    expect(schema.ownedFiles['.safeword/hooks/lib/cursor-run-identity.ts']).toBeDefined();
    expect(Object.keys(schema.jsonMerges).some(path => path.startsWith('.claude/'))).toBe(true);
  });

  it('keeps the shared runtime when no agent is selected', () => {
    const schema = projectLifecycleSchema(createTemporaryDirectory(), []);

    expect(schema.ownedFiles['.safeword/hooks/lib/cursor-run-identity.ts']).toBeDefined();
    expect(Object.keys(schema.ownedFiles).some(path => isCursorProjectPath(path))).toBe(false);
  });

  it('keeps the shared runtime for a Cursor-only project', () => {
    const schema = projectLifecycleSchema(createTemporaryDirectory(), ['cursor']);

    expect(schema.ownedFiles['.safeword/hooks/lib/cursor-run-identity.ts']).toEqual({
      template: 'hooks/lib/cursor-run-identity.ts',
    });
  });

  it('observes selected independent profiles when project configuration is absent', async () => {
    const surfaces = await observeLifecycleSurfaces(createTemporaryDirectory(), [
      'claude',
      'codex',
    ]);

    expect(surfaces.map(surface => [surface.name, surface.result.state])).toEqual([
      ['project', 'action_required'],
      ['claude', 'healthy'],
      ['codex', 'action_required'],
    ]);
  });

  it('reports the Cursor surface from its own assets, not the project outcome', async () => {
    const cwd = createTemporaryDirectory();

    const surfaces = await observeLifecycleSurfaces(cwd, ['cursor']);
    const cursor = surfaces.find(surface => surface.name === 'cursor');

    // No Cursor assets exist, so Cursor must not inherit any project verdict.
    expect(cursor?.result.state).toBe('action_required');
    expect(cursor?.result.findings.map(finding => finding.code)).toContain('CURSOR_ASSETS_MISSING');
    expect(
      cursor?.result.nextActions.flatMap(action => ('command' in action ? [action.command] : [])),
    ).toContain('safeword install --agents=cursor');
  });

  it('prioritizes an integration error action over project update guidance', () => {
    const project = createResult({
      state: 'action_required',
      findings: [{ code: 'PROJECT_UPDATE_AVAILABLE', message: 'Update.', severity: 'info' }],
      nextActions: [{ command: 'safeword install', mutates: true, requiresHuman: false }],
    });
    const opencode = createResult({
      state: 'action_required',
      findings: [{ code: 'OPENCODE_ACTIVATION_REQUIRED', message: 'Restart.', severity: 'error' }],
      nextActions: [
        {
          kind: 'human',
          instruction: 'Fully restart OpenCode.',
          mutates: false,
          requiresHuman: true,
        },
      ],
    });

    expect(
      summarizeLifecycleStatus(
        ['opencode'],
        [
          { name: 'project', result: project },
          { name: 'opencode', result: opencode, exposeData: true },
        ],
      ).nextActions,
    ).toEqual(opencode.nextActions);
  });

  it('advises when a project carries Cursor assets the selection excludes', async () => {
    const cwd = createTemporaryDirectory();
    const cursorSchema = projectLifecycleSchema(cwd, ['cursor']);
    const cursorFile = Object.keys(cursorSchema.ownedFiles).find(path => isCursorProjectPath(path));
    expect(cursorFile).toBeDefined();
    const absolute = nodePath.join(cwd, cursorFile ?? '');
    mkdirSync(nodePath.dirname(absolute), { recursive: true });
    writeFileSync(absolute, '# customer-owned\n');

    const withCursor = await observeLifecycleSurfaces(cwd, ['claude', 'codex']);
    const withoutAssets = await observeLifecycleSurfaces(createTemporaryDirectory(), [
      'claude',
      'codex',
    ]);

    const codes = (surfaces: Awaited<ReturnType<typeof observeLifecycleSurfaces>>): string[] =>
      surfaces.flatMap(surface => surface.result.findings.map(finding => finding.code));
    expect(codes(withCursor)).toContain('CURSOR_NOT_SELECTED');
    // The discriminating case: no Cursor assets means no advisory.
    expect(codes(withoutAssets)).not.toContain('CURSOR_NOT_SELECTED');
  });
});
