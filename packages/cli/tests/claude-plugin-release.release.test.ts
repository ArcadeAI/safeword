import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const CLI_ROOT = nodePath.resolve(import.meta.dirname, '..');

describe('Claude plugin release contract', () => {
  it('binds the committed catalogue to package version, hooks, inventory, and guidance', () => {
    const result = spawnSync('bun', ['scripts/check-claude-plugin-release.ts'], {
      cwd: CLI_ROOT,
      encoding: 'utf8',
    });
    expect(`${result.stdout}${result.stderr}`).toContain(
      'Claude plugin release contract is aligned',
    );
    expect(result.status).toBe(0);
  });
});
