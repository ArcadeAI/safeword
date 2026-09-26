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
      const pinned = nodePath.join(directory, 'pinned');
      const cwd = nodePath.join(directory, 'package');
      for (const path of [scripts, global, pinned, cwd]) mkdirSync(path);
      const command = nodePath.join(scripts, 'dev');
      copyFileSync(launcher, command);
      executable(nodePath.join(global, 'bun'), 'echo global-bun');
      executable(nodePath.join(global, 'node'), 'echo global-node');
      executable(nodePath.join(pinned, 'bun'), 'echo pinned-bun');
      executable(nodePath.join(pinned, 'node'), 'echo pinned-node');
      executable(nodePath.join(global, 'mise'), String.raw`printf "%s/pinned/%s\n" "$2" "$4"`);
      const result = spawnSync(
        '/bin/sh',
        [
          command,
          'sh',
          '-c',
          String.raw`bun --version; node --version; printf "%s\n" "$1"; pwd; exit 7`,
          'sh',
          'argument with spaces',
        ],
        { cwd, env: { ...process.env, PATH: `${global}:/usr/bin:/bin` }, encoding: 'utf8' },
      );
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
