/**
 * Conventional monorepo package-root directories.
 *
 * Kept dependency-free so acceptance fixtures can import the production
 * constant without loading filesystem-backed workspace discovery.
 */
export const WORKSPACE_ROOTS = ['packages', 'apps', 'libs', 'modules'] as const;
