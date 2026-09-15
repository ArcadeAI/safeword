import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');

describe('native plugin resource contract', () => {
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
