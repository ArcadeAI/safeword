import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const detector = nodePath.join(repoRoot, 'scripts/detect-retro-relay-deploy.sh');

function git(cwd: string, ...arguments_: string[]): string {
  return execFileSync('git', arguments_, { cwd, encoding: 'utf8' }).trim();
}

function temporaryDirectory(prefix: string): string {
  return mkdtempSync(nodePath.join(tmpdir(), prefix));
}

function repoWithChange(path: string): string {
  git(path, 'init', '--initial-branch=main');
  git(path, 'config', 'user.email', 'test@example.com');
  git(path, 'config', 'user.name', 'Test');
  writeFileSync(nodePath.join(path, 'README.md'), 'before\n');
  git(path, 'add', '.');
  git(path, 'commit', '-m', 'before');
  return git(path, 'rev-parse', 'HEAD');
}

function detect(cwd: string, before: string, sha: string): string {
  const output = nodePath.join(temporaryDirectory('relay-output-'), 'result');
  execFileSync(detector, [], {
    cwd,
    env: {
      ...process.env,
      BEFORE: before,
      GITHUB_OUTPUT: output,
      GITHUB_REF: 'refs/heads/main',
      SHA: sha,
    },
  });
  return readFileSync(output, 'utf8').trim();
}

describe('Retro Relay deployment input detection', () => {
  it('deploys for relay changes and ignores unrelated changes', () => {
    const project = temporaryDirectory('relay-inputs-');
    const remote = temporaryDirectory('relay-remote-');
    const before = repoWithChange(project);
    git(remote, 'init', '--bare');
    git(project, 'remote', 'add', 'origin', remote);
    git(project, 'push', 'origin', 'main');

    writeFileSync(nodePath.join(project, 'README.md'), 'unrelated\n');
    git(project, 'commit', '-am', 'unrelated');
    const unrelatedSha = git(project, 'rev-parse', 'HEAD');
    expect(detect(project, before, unrelatedSha)).toBe('deploy=false');

    const current = git(project, 'rev-parse', 'HEAD');
    writeFileSync(nodePath.join(project, 'package.json'), '{}\n');
    git(project, 'add', 'package.json');
    git(project, 'commit', '-m', 'relay input');
    const relaySha = git(project, 'rev-parse', 'HEAD');
    expect(detect(project, current, relaySha)).toBe('deploy=true');
  });

  it('deploys conservatively when the previous revision is unreachable', () => {
    const project = temporaryDirectory('relay-inputs-');
    repoWithChange(project);
    const emptyRemote = temporaryDirectory('empty-remote-');
    git(project, 'remote', 'add', 'origin', emptyRemote);

    expect(detect(project, '1111111111111111111111111111111111111111', 'HEAD')).toBe('deploy=true');
  });
});
