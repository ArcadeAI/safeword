import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { projectLifecycleSchema } from '../../src/lifecycle/schema.js';
import { observeLifecycleSurfaces } from '../../src/lifecycle/status.js';
import { isCursorProjectPath } from '../../src/schema.js';
import { createTemporaryDirectory } from '../helpers.js';

vi.mock('../../src/claude-plugin/status.js', async () => {
  const { createResult } = await import('../../src/cli-protocol/result.js');
  return {
    observeClaudeStatus: () =>
      createResult({
        state: 'healthy',
        data: { command: 'claude status', classification: 'plugin-mode' },
      }),
  };
});

vi.mock('../../src/codex-plugin/installer.js', async () => {
  const { createResult } = await import('../../src/cli-protocol/result.js');
  return {
    observeCodexMigration: () =>
      createResult({
        state: 'action_required',
        data: { command: 'codex status', classification: 'activation-pending' },
      }),
  };
});

describe('lifecycle profile observation', () => {
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
    expect(cursor?.result.nextActions.map(action => action.command)).toContain(
      'safeword install --agents=cursor',
    );
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
