import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { spoolDrafts } from '../../templates/hooks/lib/retro-draft-spool.js';
import { retroDraft } from '../helpers.js';

it('preserves packaged Codex Stop filing/no-op, option and two-attempt cap responses', () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'codex-stop-relations-'));
  try {
    const project = nodePath.join(root, 'project'),
      plugin = nodePath.join(root, 'plugin');
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(root, 'tmp'));
    writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# Synthetic owned fixture\n');
    cpSync(nodePath.resolve(import.meta.dirname, '../../codex-plugin'), plugin, {
      recursive: true,
    });
    const manifest = JSON.parse(readFileSync(nodePath.join(plugin, 'hooks.json'), 'utf8'));
    expect(manifest.hooks.Stop).toHaveLength(1);
    const group = manifest.hooks.Stop[0];
    expect(group.matcher).toBe('');
    expect(group.hooks).toHaveLength(1);
    const invoke = (active = false) => {
      const result = spawnSync('sh', ['-c', group.hooks[0].command], {
        cwd: plugin,
        encoding: 'utf8',
        timeout: 30_000,
        env: {
          PATH: process.env.PATH,
          HOME: nodePath.join(root, 'home'),
          XDG_CONFIG_HOME: nodePath.join(root, 'xdg'),
          CODEX_HOME: nodePath.join(root, 'profile'),
          PLUGIN_ROOT: plugin,
          TMPDIR: nodePath.join(root, 'tmp'),
          SAFEWORD_NO_AUTO_UPGRADE: '1',
          SAFEWORD_SKIP_INSTALL: '1',
        },
        input: JSON.stringify({
          cwd: project,
          hook_event_name: 'Stop',
          session_id: 'owned-stop',
          stop_hook_active: active,
        }),
      });
      assert.equal(
        result.error,
        undefined,
        `CODEX_COMPONENT_UNAVAILABLE: ${result.error?.message}`,
      );
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout);
    };
    expect(invoke()).toEqual({});
    spoolDrafts(project, 'owned-stop', [retroDraft('retro:aaaaaaaaaaaa')]);
    const config = nodePath.join(project, '.safeword/config.json');
    const configure = (file: boolean) => {
      writeFileSync(
        config,
        JSON.stringify({ selfReport: { capture: false, surface: false, file } }),
      );
    };
    configure(false);
    expect(invoke()).toEqual({});
    configure(true);
    expect(invoke(true)).toEqual({});
    for (let attempt = 0; attempt < 2; attempt++)
      expect(invoke()).toMatchObject({
        decision: 'block',
        reason: expect.stringContaining('safeword:retro-filer'),
      });
    expect(invoke()).toEqual({});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
