/** Dependency-free inventory of helpers the packaged project runtime may execute. */
export const PROJECT_RUNTIME_HELPERS = {
  'audit-principle-trace': ['templates/hooks/audit-principle-trace.ts', 'bun'],
  'cleanup-zombies': ['templates/scripts/cleanup-zombies.sh', 'bash'],
  'closeout-cleanup': ['templates/scripts/closeout-cleanup.ts', 'bun'],
  'resolve-verify-ticket': ['templates/hooks/resolve-verify-ticket.ts', 'bun'],
  'write-review-stamp': ['templates/hooks/write-review-stamp.ts', 'bun'],
} as const;

export type ProjectRuntimeHelper = keyof typeof PROJECT_RUNTIME_HELPERS;
export type ProjectRuntimeHelperDefinition = (typeof PROJECT_RUNTIME_HELPERS)[ProjectRuntimeHelper];

export const PROJECT_RUNTIME_SCRIPT_PATHS = Object.values(PROJECT_RUNTIME_HELPERS)
  .map(([relativePath]) => relativePath)
  .filter(relativePath => relativePath.startsWith('templates/scripts/'));

export function projectRuntimeHelperDefinition(
  helper: string | undefined,
): ProjectRuntimeHelperDefinition | undefined {
  if (
    helper === undefined ||
    !Object.prototype.hasOwnProperty.call(PROJECT_RUNTIME_HELPERS, helper)
  )
    return undefined;
  return PROJECT_RUNTIME_HELPERS[helper as ProjectRuntimeHelper];
}
