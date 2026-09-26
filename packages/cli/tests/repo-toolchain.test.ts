import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const launcher = nodePath.resolve(import.meta.dirname, '../../../scripts/dev');

function executable(path: string, source: string): void {
  writeFileSync(path, `#!/bin/sh\n${source}\n`, { mode: 0o755 });
}

describe('repository toolchain launcher', () => {
  it('pins child tools despite global PATH precedence and preserves invocation semantics', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-toolchain-'));
    try {
      const scripts = nodePath.join(directory, 'scripts');
      const global = nodePath.join(directory, 'global');
      const pinnedBun = nodePath.join(directory, 'pinned-bun');
      const pinnedNode = nodePath.join(directory, 'pinned-node');
      const cwd = nodePath.join(directory, 'package');
      for (const path of [scripts, global, pinnedBun, pinnedNode, cwd]) mkdirSync(path);
      const command = nodePath.join(scripts, 'dev');
      copyFileSync(launcher, command);
      executable(nodePath.join(global, 'bun'), 'echo global-bun');
      executable(nodePath.join(global, 'node'), 'echo global-node');
      executable(nodePath.join(pinnedBun, 'bun'), 'echo pinned-bun');
      executable(nodePath.join(pinnedNode, 'node'), 'echo pinned-node');
      executable(
        nodePath.join(global, 'mise'),
        String.raw`printf "%s/pinned-%s/%s\n" "$2" "$4" "$4"`,
      );
      const result = spawnSync(
        command,
        [
          'sh',
          '-c',
          String.raw`bun --version; node --version; printf "%s\n" "$1"; pwd; exit 7`,
          'sh',
          'argument with spaces',
        ],
        { cwd, env: { ...process.env, PATH: `${global}:/usr/bin:/bin` }, encoding: 'utf8' },
      );
      const pathResult = spawnSync(command, ['--print-path'], {
        cwd,
        env: { ...process.env, PATH: `${global}:/usr/bin:/bin` },
        encoding: 'utf8',
      });
      expect(pathResult.status).toBe(0);
      expect(pathResult.stdout.trim().split(nodePath.delimiter)).toEqual([
        pinnedBun,
        pinnedNode,
        global,
        '/usr/bin',
        '/bin',
      ]);
      expect(result.status).toBe(7);
      expect(result.stdout.trim().split('\n')).toEqual([
        'pinned-bun',
        'pinned-node',
        'argument with spaces',
        realpathSync(cwd),
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('explains how to install unavailable pinned tools', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-toolchain-'));
    try {
      executable(nodePath.join(directory, 'mise'), 'exit 1');
      const result = spawnSync('/bin/sh', [launcher, 'bun', '--version'], {
        env: { ...process.env, PATH: `${directory}:/usr/bin:/bin` },
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Pinned Bun/Node unavailable. Run mise install');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('gives an actionable setup error when mise is unavailable', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-toolchain-'));
    try {
      const result = spawnSync('/bin/sh', [launcher, 'bun', '--version'], {
        env: { ...process.env, PATH: directory },
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Install mise, then run mise install');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
