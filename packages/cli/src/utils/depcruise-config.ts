/**
 * Dependency-cruiser config generator
 *
 * Generates dependency-cruiser configuration from detected architecture.
 * Used by `safeword sync-config` command and `/audit` slash command.
 */

import nodePath from 'node:path';

import type { DetectedArchitecture } from './boundaries.js';
import { readJson } from './fs.js';

export interface DependencyCruiseArchitecture extends DetectedArchitecture {
  workspaces?: string[];
}

interface PackageJson {
  workspaces?: string[] | { packages?: string[] };
}

/**
 * Detect workspaces from package.json
 * Supports both array format and object format (yarn workspaces)
 */
export function detectWorkspaces(cwd: string): string[] | undefined {
  const packageJsonPath = nodePath.join(cwd, 'package.json');
  const packageJson = readJson(packageJsonPath) as PackageJson | undefined;

  if (!packageJson?.workspaces) return undefined;

  // Handle both formats: string[] or { packages: string[] }
  const workspaces = Array.isArray(packageJson.workspaces)
    ? packageJson.workspaces
    : packageJson.workspaces.packages;

  return workspaces && workspaces.length > 0 ? workspaces : undefined;
}

/**
 * Generate monorepo hierarchy rules based on workspace patterns
 */
function generateMonorepoRules(workspaces: string[]): string {
  const rules: string[] = [];

  const hasLibs = workspaces.some(w => w.startsWith('libs'));
  const hasPackages = workspaces.some(w => w.startsWith('packages'));
  const hasApps = workspaces.some(w => w.startsWith('apps'));

  // libs cannot import packages or apps
  if (hasLibs && (hasPackages || hasApps)) {
    rules.push(`    {
      name: 'libs-cannot-import-packages-or-apps',
      severity: 'error',
      from: { path: '^libs/' },
      to: { path: '^(packages|apps)/' },
    }`);
  }

  // packages cannot import apps
  if (hasPackages && hasApps) {
    rules.push(`    {
      name: 'packages-cannot-import-apps',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    }`);
  }

  return rules.join(',\n');
}

/**
 * Generate .safeword/depcruise-config.cjs content (forbidden rules + options)
 */
export function generateDependencyCruiseConfigFile(arch: DependencyCruiseArchitecture): string {
  const monorepoRules = arch.workspaces ? generateMonorepoRules(arch.workspaces) : '';
  const hasMonorepoRules = monorepoRules.length > 0;

  return String.raw`module.exports = {
  forbidden: [
    // =========================================================================
    // ERROR RULES (block on violations)
    // =========================================================================
    {
      name: 'no-circular',
      // Runtime cycles cause initialization-order bugs and make code hard to reason about.
      // Type-only edges (import type) are erased at compile time and cannot cause runtime
      // cycles - TypeScript designed import type for exactly this case, and depcruise
      // documents viaOnly + dependencyTypesNot: ['type-only'] as the canonical opt-in.
      comment: 'Circular dependencies cause runtime issues and make code hard to reason about',
      severity: 'error',
      from: {},
      to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
    },
    {
      name: 'no-deprecated-deps',
      comment: 'Deprecated npm packages should be replaced - they may have security issues or be unmaintained',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['deprecated'] },
    },${hasMonorepoRules ? `\n${monorepoRules},` : ''}

    // =========================================================================
    // WARNING RULES (flag issues but don't block)
    // =========================================================================
    {
      name: 'no-dev-deps-in-src',
      comment: 'Production code should not import devDependencies - may cause runtime failures',
      severity: 'warn',
      from: {
        path: ['^src', '^packages/[^/]+/src'],
        pathNot: '\\.test\\.[tj]sx?$',
      },
      to: { dependencyTypes: ['npm-dev'] },
    },
    {
      name: 'no-orphans',
      comment: 'Orphan modules are not imported anywhere - may be dead code',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          // Entry points
          '(^|/)index\\.[tj]sx?$',
          '(^|/)main\\.[tj]sx?$',
          '(^|/)cli\\.[tj]s$',
          '(^|/)cucumber\\.mjs$',
          '\\.config\\.[tj]s$',
          '\\.config\\.mjs$',
          // Test files
          '\\.test\\.[tj]sx?$',
          '\\.spec\\.[tj]sx?$',
          '/tests/',
          '/__tests__/',
          // Astro/Next.js pages and content
          '/src/content/',
          '/src/pages/',
          '/app/',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', '.safeword'] },
    exclude: {
      path: ['node_modules', 'dist', 'build', 'coverage', '\\.d\\.ts$'],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
`;
}

/**
 * Generate .dependency-cruiser.js (main config that imports generated)
 */
export function generateDependencyCruiseMainConfig(): string {
  return `/**
 * Dependency Cruiser Configuration
 *
 * Imports auto-generated rules from .safeword/depcruise-config.cjs
 * ADD YOUR CUSTOM RULES BELOW the spread operator.
 */

const generated = require('./.safeword/depcruise-config.cjs');

module.exports = {
  forbidden: [
    ...generated.forbidden,
    // ADD YOUR CUSTOM RULES BELOW:
    // { name: 'no-legacy', from: { path: 'legacy/' }, to: { path: 'new/' } },
  ],
  options: {
    ...generated.options,
    // Your overrides here
  },
};
`;
}
