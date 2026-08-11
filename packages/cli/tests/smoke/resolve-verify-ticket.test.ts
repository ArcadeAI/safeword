import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const installedHelper = nodePath.join(repoRoot, '.safeword/hooks/resolve-verify-ticket.ts');

describe('installed resolve-verify-ticket.ts smoke', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
    execFileSync('git', ['-C', projectDirectory, 'init', '--initial-branch=main'], {
      stdio: 'ignore',
    });
    const ticketDirectory = nodePath.join(
      projectDirectory,
      '.project/tickets/SMOKE1-current-ticket',
    );
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      '---\nid: SMOKE1\ntype: task\nphase: verify\nstatus: in_progress\n---\n',
    );
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('resolves an explicit ticket through the installed command surface', () => {
    const result = spawnSync('bun', [installedHelper, projectDirectory, '--ticket', 'SMOKE1'], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim()).toBe(
      nodePath.join(projectDirectory, '.project/tickets/SMOKE1-current-ticket/ticket.md'),
    );
  });

  it('resolves current-work evidence through the installed command surface', () => {
    const result = spawnSync('bun', [installedHelper, projectDirectory], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim()).toBe(
      nodePath.join(projectDirectory, '.project/tickets/SMOKE1-current-ticket/ticket.md'),
    );
  });
});
