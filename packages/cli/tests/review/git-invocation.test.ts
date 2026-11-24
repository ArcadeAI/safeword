import { execFileSync } from 'node:child_process';
import { linkSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it, vi } from 'vitest';

import { proofGit } from '../../src/review/retrospective-proof.js';

it('reads committed Git bytes through the selected name when native realpath returns another hard link', () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'safeword-git-name-'));
  const root = path.join(temporary, 'repository');
  const bin = path.join(temporary, 'tools');
  mkdirSync(root);
  mkdirSync(bin);
  const actualGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const git = (...args: string[]) => execFileSync(actualGit, ['-C', root, ...args]);
  try {
    git('init', '-q');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.com');
    git('config', 'commit.gpgsign', 'false');
    writeFileSync(path.join(root, 'tracked.txt'), 'committed bytes\n');
    git('add', 'tracked.txt');
    git('commit', '-qm', 'owned dispatch fixture');
    const compiler = path.join(bin, 'compiler');
    const invocation = path.join(bin, 'git');
    writeFileSync(
      compiler,
      `#!${process.execPath}
const path = require('node:path');
if(path.basename(process.argv[1])!=='git'){console.error('wrong hard-link tool name');process.exit(64);}
const result=require('node:child_process').spawnSync(${JSON.stringify(actualGit)},process.argv.slice(2),{stdio:'inherit'});
process.exit(result.status??1);
`,
      { mode: 0o755 },
    );
    linkSync(compiler, invocation);
    const native = realpathSync.native;
    // Model Bun's observed macOS F_GETPATH error at the filesystem boundary.
    // The two real links share bytes but dispatch by their invocation names.
    vi.spyOn(realpathSync, 'native').mockImplementation(input =>
      String(input) === invocation ? compiler : native(input),
    );
    vi.stubEnv('PATH', `${bin}${path.delimiter}${process.env.PATH ?? ''}`);
    expect(proofGit(root, ['show', 'HEAD:tracked.txt']).toString('utf8')).toBe('committed bytes\n');
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    rmSync(temporary, { recursive: true, force: true });
  }
});
