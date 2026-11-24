import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const PLUGIN_ROOT = nodePath.resolve(import.meta.dirname, '../../codex-plugin');
const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures) rmSync(fixture, { recursive: true, force: true });
  fixtures.length = 0;
});

function runSessionStart(pluginRoot: string, project: string, codexHome: string) {
  return spawnSync(
    'bun',
    [
      nodePath.join(pluginRoot, 'runtime/cli.js'),
      'hook',
      'codex',
      'session-start',
      '--plugin-hook',
    ],
    {
      cwd: project,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: '', CODEX_HOME: codexHome },
      input: JSON.stringify({ cwd: project, session_id: 'packaged-handbook-test' }),
    },
  );
}

describe('Codex plugin handbook authority', () => {
  it.each(['missing', 'empty'] as const)(
    'fails loudly when the bundled handbook is %s instead of naming the project copy',
    state => {
      const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-handbook-'));
      fixtures.push(fixture);
      const pluginRoot = nodePath.join(fixture, 'plugin');
      cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
      for (const handbook of ['resources/SAFEWORD.md', 'templates/SAFEWORD.md']) {
        if (state === 'missing') rmSync(nodePath.join(pluginRoot, handbook));
        else writeFileSync(nodePath.join(pluginRoot, handbook), '  \n');
      }
      const project = nodePath.join(fixture, 'project');
      mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
      writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# Stale project copy\n');

      const result = runSessionStart(pluginRoot, project, nodePath.join(fixture, 'codex-home'));

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('missing its packaged handbook');
      expect(result.stderr).toContain(nodePath.join(pluginRoot, 'resources/SAFEWORD.md'));
      expect(`${result.stdout}${result.stderr}`).not.toContain('.safeword/SAFEWORD.md');
    },
    30_000,
  );

  it('points an enrolled project at the bundled handbook and guides', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-handbook-'));
    fixtures.push(fixture);
    const project = nodePath.join(fixture, 'project');
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# Stale project copy\n');

    const result = runSessionStart(PLUGIN_ROOT, project, nodePath.join(fixture, 'codex-home'));

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(nodePath.join(PLUGIN_ROOT, 'resources/SAFEWORD.md'));
    expect(result.stdout).not.toContain('.safeword/SAFEWORD.md');
    expect(result.stdout).not.toContain('.safeword/guides/');
  }, 30_000);
});
