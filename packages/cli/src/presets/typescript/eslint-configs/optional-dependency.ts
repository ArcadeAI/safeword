import { createRequire } from 'node:module';
import nodePath from 'node:path';

const requireFromHere = createRequire(import.meta.url);

/**
 * Load an optional ESLint plugin from the user's project first, then from
 * safeword's own install context. This lets consumers opt into plugins that
 * safeword does not ship as production dependencies.
 */
export function optionalRequire(packageName: string): unknown {
  try {
    const requireFromCwd = createRequire(nodePath.join(process.cwd(), '__placeholder__.js'));
    return requireFromCwd(packageName);
  } catch {
    // Fall back to safeword's context below.
  }

  try {
    return requireFromHere(packageName);
  } catch {
    return undefined;
  }
}

export function hasOptionalDependency(packageName: string): boolean {
  return optionalRequire(packageName) !== undefined;
}
