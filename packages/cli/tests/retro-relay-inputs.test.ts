import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

function detect(
  cwd: string,
  before: string,
  sha: string,
  githubReference = 'refs/heads/main',
): string {
  const output = nodePath.join(temporaryDirectory('relay-output-'), 'result');
  execFileSync(detector, [], {
    cwd,
    env: {
      ...process.env,
      BEFORE: before,
      GITHUB_OUTPUT: output,
      GITHUB_REF: githubReference,
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
    git(project, 'push', 'origin', 'main');
    expect(detect(project, before, unrelatedSha)).toBe('deploy=false');

    const current = git(project, 'rev-parse', 'HEAD');
    mkdirSync(nodePath.join(project, 'packages/retro-relay'), { recursive: true });
    writeFileSync(nodePath.join(project, 'packages/retro-relay/index.ts'), 'export {};\n');
    git(project, 'add', 'packages/retro-relay/index.ts');
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

  it('does not deploy outside main or without a previous revision', () => {
    const project = temporaryDirectory('relay-inputs-');
    const sha = repoWithChange(project);

    expect(detect(project, sha, sha, 'refs/heads/feature')).toBe('deploy=false');
    expect(detect(project, '', sha)).toBe('deploy=false');
  });

  it('deploys a new main branch conservatively', () => {
    const project = temporaryDirectory('relay-inputs-');
    const sha = repoWithChange(project);

    expect(detect(project, '0000000000000000000000000000000000000000', sha)).toBe('deploy=true');
  });
});
