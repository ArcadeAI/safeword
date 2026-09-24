import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');

describe('native plugin resource contract', () => {
  it('rejects an unexpected file at the Claude plugin root during generation checks', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-plugin-drift-'));
    try {
      const shippedPlugin = nodePath.join(fixture, 'plugin');
      cpSync(nodePath.join(REPO_ROOT, 'plugin'), shippedPlugin, { recursive: true });
      writeFileSync(nodePath.join(shippedPlugin, 'stray-root-file.txt'), 'unexpected\n');

      const result = spawnSync(
        'bun',
        [nodePath.join(REPO_ROOT, 'packages/cli/scripts/generate-claude-plugin.ts'), '--check'],
        {
          cwd: nodePath.join(REPO_ROOT, 'packages/cli'),
          encoding: 'utf8',
          env: { ...process.env, SAFEWORD_CLAUDE_GENERATED_PLUGIN_ROOT: shippedPlugin },
        },
      );

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain('unexpected stray-root-file.txt');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 15_000);

  it.each([
    ['Claude', nodePath.join(REPO_ROOT, 'plugin')],
    ['Codex', nodePath.join(REPO_ROOT, 'packages/cli/codex-plugin')],
  ])(
    'runs template-backed commands from the committed %s plugin bundle',
    (bundleName, pluginSource) => {
      const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-plugin-resource-'));
      try {
        const isolatedPlugin = nodePath.join(fixture, 'plugin');
        const project = nodePath.join(fixture, 'project');
        cpSync(pluginSource, isolatedPlugin, { recursive: true });
        mkdirSync(project);
        for (const relativePath of [
          'doc-templates/impl-plan-template.md',
          'guides/testing-guide.md',
          'scripts/cleanup-zombies.sh',
        ]) {
          expect(
            existsSync(nodePath.join(isolatedPlugin, 'templates', relativePath)),
            `${bundleName} did not package templates/${relativePath}`,
          ).toBe(true);
        }
        const runtime = nodePath.join(isolatedPlugin, 'runtime/cli.js');
        const ticket = spawnSync(
          'bun',
          [runtime, 'ticket', 'new', 'plugin-resource-proof', '--type=feature'],
          { cwd: project, encoding: 'utf8' },
        );
        expect(ticket.status, `${bundleName}: ${ticket.stdout}${ticket.stderr}`).toBe(0);
        expect(ticket.stdout).toContain('Changed: yes');
        const ticketDirectory = nodePath.join(
          project,
          '.project/tickets',
          readdirSync(nodePath.join(project, '.project/tickets')).find(name =>
            name.endsWith('-plugin-resource-proof'),
          ) ?? 'missing-ticket',
        );
        expect(readFileSync(nodePath.join(ticketDirectory, 'spec.md'), 'utf8')).toContain(
          '# Product Plan:',
        );

        const install = spawnSync(
          'bun',
          [runtime, 'install', '--agents=none', '--no-input', '--offline'],
          { cwd: project, encoding: 'utf8' },
        );
        expect(install.status, `${bundleName}: ${install.stdout}${install.stderr}`).toBe(0);
        expect(readFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'))).toEqual(
          readFileSync(nodePath.join(isolatedPlugin, 'templates/SAFEWORD.md')),
        );
      } finally {
        rmSync(fixture, { recursive: true, force: true });
      }
    },
    30_000,
  );
});
