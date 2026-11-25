import { realpathSync } from 'node:fs';

export interface IsolatedGraderBinding {
  readonly project: string;
  readonly profile: string;
  readonly runtime: string;
}
declare const __SAFEWORD_ISOLATED_GRADER_BINDING__: string | undefined;

/** Evaluation-only build data; normal distributions compile this to disabled.
 * Scope is the worker's original project, not its neutral reviewer workspace.
 */
export function isolatedGraderScope(): 'disabled' | 'valid' | 'invalid' {
  if (typeof __SAFEWORD_ISOLATED_GRADER_BINDING__ !== 'string') return 'disabled';
  try {
    const scope = JSON.parse(__SAFEWORD_ISOLATED_GRADER_BINDING__) as IsolatedGraderBinding;
    return realpathSync(process.cwd()) === scope.project &&
      realpathSync(process.env.CODEX_HOME ?? '') === scope.profile &&
      realpathSync(process.argv[1] ?? '') === scope.runtime
      ? 'valid'
      : 'invalid';
  } catch {
    return 'invalid';
  }
}
