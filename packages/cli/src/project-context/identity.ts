import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import nodePath from 'node:path';

import type { ProjectIdentity } from './types.js';

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function gitPath(cwd: string, argument: '--absolute-git-dir' | '--git-common-dir'): string {
  const output = execFileSync('git', ['rev-parse', argument], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  return realpathSync(nodePath.resolve(cwd, output));
}

export function resolveProjectIdentity(cwd: string): ProjectIdentity {
  const canonicalDirectory = realpathSync(cwd);
  try {
    const commonDirectory = gitPath(canonicalDirectory, '--git-common-dir');
    const worktreeDirectory = gitPath(canonicalDirectory, '--absolute-git-dir');
    return {
      kind: 'git',
      projectKey: digest(commonDirectory),
      worktreeKey: digest(worktreeDirectory),
    };
  } catch {
    const key = digest(canonicalDirectory);
    return { kind: 'directory', projectKey: key, worktreeKey: key };
  }
}
