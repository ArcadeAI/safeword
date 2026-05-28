/**
 * Integration tests for cross-process and cross-branch ticket creation
 * (ticket 158, slice 7).
 *
 * Covers Rule 8 in test-definitions.md — the load-bearing claim of the whole
 * feature: parallel sessions and independent branches cannot land silent
 * ID collisions in main. Two real `git init` fixtures + child_process.spawn
 * for honest concurrency (vitest's single-worker scheduling can't surface
 * the race on its own).
 *
 * SAFEWORD_TICKET_ID_OVERRIDE forces a deterministic mint so the
 * collision-forced scenarios are exact, not probabilistic.
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  TIMEOUT_QUICK,
  TIMEOUT_SYNC,
} from '../helpers.js';

const CLI_PATH = nodePath.join(import.meta.dirname, '..', '..', 'dist', 'cli.js');

function gitSync(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

async function runCliInProcess(
  cwd: string,
  env: Record<string, string> = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [CLI_PATH, 'ticket', 'new', 'parallel-test'], {
      cwd,
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => (stdout += String(chunk)));
    child.stderr.on('data', chunk => (stderr += String(chunk)));
    child.on('close', exitCode => {
      resolve({ exitCode: exitCode ?? -1, stdout, stderr });
    });
  });
}

function readTicketIds(ticketsDirectory: string): string[] {
  const ids: string[] = [];
  for (const folder of readdirSync(ticketsDirectory)) {
    const ticketPath = nodePath.join(ticketsDirectory, folder, 'ticket.md');
    const content = readFileSync(ticketPath, 'utf8');
    const match = /^id:\s*(\S+)/m.exec(content);
    if (match?.[1] !== undefined) ids.push(match[1]);
  }
  return ids;
}

describe('cross-process ticket creation', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it(
    'two parallel processes each mint a distinct ticket ID',
    async () => {
      const [a, b] = await Promise.all([
        runCliInProcess(projectDirectory),
        runCliInProcess(projectDirectory),
      ]);
      expect(a.exitCode).toBe(0);
      expect(b.exitCode).toBe(0);

      const ticketsDirectory = nodePath.join(projectDirectory, '.safeword-project', 'tickets');
      const ids = readTicketIds(ticketsDirectory);
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
    },
    TIMEOUT_QUICK,
  );
});

describe('cross-branch ticket creation (real git fixture)', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
    initGitRepo(projectDirectory);
    // Seed with an initial commit so branches have a common ancestor.
    writeFileSync(nodePath.join(projectDirectory, 'README.md'), '# init\n');
    gitSync(projectDirectory, 'add', '.');
    gitSync(projectDirectory, 'commit', '-m', 'init');
    gitSync(projectDirectory, 'branch', '-M', 'main');
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it(
    'two branches each minting a ticket merge to main with distinct IDs',
    () => {
      gitSync(projectDirectory, 'checkout', '-b', 'feature-a');
      spawnSync(process.execPath, [CLI_PATH, 'ticket', 'new', 'feature-a'], {
        cwd: projectDirectory,
        stdio: 'pipe',
      });
      gitSync(projectDirectory, 'add', '.');
      gitSync(projectDirectory, 'commit', '-m', 'ticket a');

      gitSync(projectDirectory, 'checkout', 'main');
      gitSync(projectDirectory, 'checkout', '-b', 'feature-b');
      spawnSync(process.execPath, [CLI_PATH, 'ticket', 'new', 'feature-b'], {
        cwd: projectDirectory,
        stdio: 'pipe',
      });
      gitSync(projectDirectory, 'add', '.');
      gitSync(projectDirectory, 'commit', '-m', 'ticket b');

      gitSync(projectDirectory, 'checkout', 'main');
      gitSync(projectDirectory, 'merge', '--no-ff', '-m', 'merge a', 'feature-a');
      gitSync(projectDirectory, 'merge', '--no-ff', '-m', 'merge b', 'feature-b');

      const ticketsDirectory = nodePath.join(projectDirectory, '.safeword-project', 'tickets');
      const ids = readTicketIds(ticketsDirectory);
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
    },
    TIMEOUT_QUICK,
  );

  it(
    'two branches forced to mint the same ID merge cleanly but are caught by the duplicate-ID detector',
    () => {
      // Folder layout is `{ID}-{slug}/` (PR #160), so two branches force-minting
      // the same ID with different slugs produce different paths (`COLLID-foo/`,
      // `COLLID-bar/`) and the second merge succeeds. The duplicate-ID detector
      // (check-ticket-ids.ts, wired into pre-commit + CI) is the loud-failure
      // mechanism that catches this state — see the
      // `duplicate-ID guard last-line defense` describe below.
      const forcedId = 'COLLID';
      const overrideEnvironment = { ...process.env, SAFEWORD_TICKET_ID_OVERRIDE: forcedId };

      gitSync(projectDirectory, 'checkout', '-b', 'feature-a');
      spawnSync(process.execPath, [CLI_PATH, 'ticket', 'new', 'foo'], {
        cwd: projectDirectory,
        env: overrideEnvironment,
        stdio: 'pipe',
      });
      gitSync(projectDirectory, 'add', '.');
      gitSync(projectDirectory, 'commit', '-m', 'ticket a');

      gitSync(projectDirectory, 'checkout', 'main');
      gitSync(projectDirectory, 'checkout', '-b', 'feature-b');
      spawnSync(process.execPath, [CLI_PATH, 'ticket', 'new', 'bar'], {
        cwd: projectDirectory,
        env: overrideEnvironment,
        stdio: 'pipe',
      });
      gitSync(projectDirectory, 'add', '.');
      gitSync(projectDirectory, 'commit', '-m', 'ticket b');

      gitSync(projectDirectory, 'checkout', 'main');
      gitSync(projectDirectory, 'merge', '--no-ff', '-m', 'merge a', 'feature-a');

      const secondMerge = spawnSync('git', ['merge', '--no-ff', '-m', 'merge b', 'feature-b'], {
        cwd: projectDirectory,
        encoding: 'utf8',
      });
      expect(secondMerge.status).toBe(0);

      const ticketsDirectory = nodePath.join(projectDirectory, '.safeword-project', 'tickets');
      const folders = readdirSync(ticketsDirectory).toSorted();
      expect(folders).toEqual(['COLLID-bar', 'COLLID-foo']);

      const scriptPath = nodePath.join(
        import.meta.dirname,
        '..',
        '..',
        '..',
        '..',
        'scripts',
        'check-ticket-ids.ts',
      );
      const detectorResult = spawnSync('bun', [scriptPath], {
        cwd: projectDirectory,
        encoding: 'utf8',
        timeout: 10_000,
      });
      expect(detectorResult.status).toBe(1);
      expect(detectorResult.stderr).toContain('COLLID');
    },
    TIMEOUT_SYNC,
  );
});

describe('duplicate-ID guard last-line defense', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it(
    'flags a synthetic main-state collision (two folders, same `id:`)',
    () => {
      const ticketsDirectory = nodePath.join(projectDirectory, '.safeword-project', 'tickets');
      for (const folder of ['LANDED', 'LANDED-spurious']) {
        const directory = nodePath.join(ticketsDirectory, folder);
        mkdirSync(directory, { recursive: true });
        writeFileSync(
          nodePath.join(directory, 'ticket.md'),
          `---
id: LANDED
type: task
status: in_progress
---
`,
        );
      }

      const scriptPath = nodePath.join(
        import.meta.dirname,
        '..',
        '..',
        '..',
        '..',
        'scripts',
        'check-ticket-ids.ts',
      );
      const result = spawnSync('bun', [scriptPath], {
        cwd: projectDirectory,
        encoding: 'utf8',
        timeout: 10_000,
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('LANDED');
    },
    TIMEOUT_QUICK,
  );
});
