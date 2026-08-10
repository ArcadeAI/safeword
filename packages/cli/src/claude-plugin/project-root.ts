import { spawnSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import nodePath from 'node:path';

function canonicalDirectory(path: unknown): string | undefined {
  if (typeof path !== 'string' || path.trim() === '') return undefined;
  try {
    if (!statSync(path).isDirectory()) return undefined;
    return nodePath.normalize(realpathSync(path));
  } catch {
    return undefined;
  }
}

export function canonicalClaudeProjectRoot(cwd: string): string {
  const configuredRoot = process.env.CLAUDE_PROJECT_DIR;
  const environmentRoot = configuredRoot === undefined ? undefined : configuredRoot.trim();
  let candidate = environmentRoot === '' ? undefined : environmentRoot;
  if (candidate === undefined) {
    const result = spawnSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    });
    const gitRoot = result.status === 0 ? result.stdout?.trim() : undefined;
    candidate = gitRoot === '' || gitRoot === undefined ? cwd : gitRoot;
  }
  const canonical = canonicalDirectory(candidate);
  if (canonical === undefined) {
    throw new Error(
      `Claude project root is missing, not a directory, or cannot be resolved: ${candidate}`,
    );
  }
  return canonical;
}
