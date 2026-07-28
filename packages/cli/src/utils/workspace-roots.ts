/**
 * Conventional monorepo package-root directories.
 *
 * Shared so the scanners that walk them — workspace-member, BDD feature-source,
 * and cucumber-harness detection — cannot drift when a root is added.
 *
 * Kept dependency-free so acceptance fixtures can import the production
 * constant without loading filesystem-backed workspace discovery.
 */
export const WORKSPACE_ROOTS = ['packages', 'apps', 'libs', 'modules'] as const;
