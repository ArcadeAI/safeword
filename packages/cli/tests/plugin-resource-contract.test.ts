import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');

describe('native plugin resource contract', () => {
  it('runs template-backed commands from both committed native plugin bundles', () => {
    const pluginSources = [
      nodePath.join(REPO_ROOT, 'plugin'),
      nodePath.join(REPO_ROOT, 'packages/cli/codex-plugin'),
    ];

    for (const [index, pluginSource] of pluginSources.entries()) {
      const fixture = mkdtempSync(nodePath.join(tmpdir(), `safeword-plugin-resource-${index}-`));
      try {
        const isolatedPlugin = nodePath.join(fixture, 'plugin');
        const project = nodePath.join(fixture, 'project');
        cpSync(pluginSource, isolatedPlugin, { recursive: true });
        mkdirSync(project);
        const runtime = nodePath.join(isolatedPlugin, 'runtime/cli.js');
        const ticket = spawnSync(
          'bun',
          [runtime, 'ticket', 'new', 'plugin-resource-proof', '--type=feature'],
          { cwd: project, encoding: 'utf8' },
        );
        expect(ticket.status, `${ticket.stdout}${ticket.stderr}`).toBe(0);
        expect(ticket.stdout).toContain('Changed: yes');

        const install = spawnSync(
          'bun',
          [runtime, 'install', '--agents=none', '--no-input', '--offline'],
          { cwd: project, encoding: 'utf8' },
        );
        expect(install.status, `${install.stdout}${install.stderr}`).toBe(0);
        expect(existsSync(nodePath.join(project, '.safeword/SAFEWORD.md'))).toBe(true);
      } finally {
        rmSync(fixture, { recursive: true, force: true });
      }
    }
  });
});
