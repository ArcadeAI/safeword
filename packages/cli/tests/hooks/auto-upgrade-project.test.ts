/**
 * An automatic upgrade runs against the project the session resolved, not the
 * launch checkout (#5467). The CLI still prefers CLAUDE_PROJECT_DIR when it is
 * set, and the host keeps that at the launch checkout in a worktree session,
 * so the upgrade child must be told which project it is upgrading.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runAutoUpgrade } from '../../templates/hooks/lib/auto-upgrade.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('auto-upgrade project (#5467)', () => {
  let root: string;
  let launch: string;
  let worktree: string;

  beforeEach(() => {
    root = createTemporaryDirectory();
    launch = nodePath.join(root, 'launch');
    worktree = nodePath.join(root, 'worktree');
    mkdirSync(nodePath.join(launch, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(worktree, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(worktree, '.safeword', 'version'), '1.0.0\n');
  });

  afterEach(() => {
    removeTemporaryDirectory(root);
  });

  it("runs the upgrade with the resolved worktree as the CLI's project", async () => {
    const now = Date.now();
    writeFileSync(
      nodePath.join(worktree, '.safeword', '.update-cache.json'),
      JSON.stringify({ latestVersion: '1.1.0', publishedAt: now - 30 * DAY_MS, checkedAt: now }),
    );
    const upgrades: { cwd: string; projectFromEnvironment: string | undefined }[] = [];

    await runAutoUpgrade({
      projectDir: worktree,
      filterSafewordFiles: () => [],
      env: { CLAUDE_PROJECT_DIR: launch },
      now: () => now,
      fetchLatestFromNpm: () => Promise.resolve(undefined),
      dogfoodRepo: () => false,
      // A clean git checkout on a branch, so the upgrade is attempted.
      execSync: command => {
        if (command.includes('rev-parse -q --verify MERGE_HEAD')) throw new Error('no merge');
        return '';
      },
      execFileSync: (command, args, options) => {
        if (command === 'bunx' && args.includes('upgrade')) {
          upgrades.push({
            cwd: options.cwd,
            projectFromEnvironment: options.env?.CLAUDE_PROJECT_DIR,
          });
        }
        return '';
      },
    });

    expect(upgrades).toEqual([{ cwd: worktree, projectFromEnvironment: worktree }]);
  });
});
