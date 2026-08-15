import { execFileSync } from 'node:child_process';
import nodePath from 'node:path';

export function resolveCodexProjectDirectory(
  cwd: string = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const configuredProject = environment.CLAUDE_PROJECT_DIR?.trim();
  if (configuredProject) return nodePath.resolve(configuredProject);

  try {
    const root = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
    if (root.length > 0) return root;
  } catch {
    // Fall back when the task is outside git or git is unavailable.
  }

  return nodePath.resolve(cwd);
}
