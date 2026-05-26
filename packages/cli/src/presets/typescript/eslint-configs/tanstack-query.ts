/**
 * ESLint configuration for TanStack Query
 *
 * Enforces best practices for TanStack Query (React Query).
 * All 7 rules at error severity - LLMs have no valid reason to violate these.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */

import { createRequire } from 'node:module';

import { lazyConfigArray } from './lazy.js';

const requireFromHere = createRequire(import.meta.url);

/**
 * TanStack Query linting config
 *
 * All rules at error severity:
 * - exhaustive-deps: Missing query key deps → stale cached data
 * - stable-query-client: Client in component → infinite re-render loop
 * - no-void-query-fn: No return → undefined cached
 * - no-rest-destructuring: ...rest loses reactivity
 * - no-unstable-deps: New function each render → unnecessary refetches
 * - infinite-query-property-order: Wrong order → TypeScript can't infer types
 * - mutation-property-order: Wrong order → TypeScript can't infer types
 *
 * Plugin is loaded lazily — only when this config is actually accessed.
 */
export const tanstackQueryConfig: any[] = lazyConfigArray(() => {
  const tanstackQueryPlugin = requireFromHere('@tanstack/eslint-plugin-query');
  return [
    {
      name: 'safeword/tanstack-query',
      plugins: {
        '@tanstack/query': tanstackQueryPlugin,
      },
      rules: {
        '@tanstack/query/exhaustive-deps': 'error',
        '@tanstack/query/stable-query-client': 'error',
        '@tanstack/query/no-void-query-fn': 'error',
        '@tanstack/query/no-rest-destructuring': 'error',
        '@tanstack/query/no-unstable-deps': 'error',
        '@tanstack/query/infinite-query-property-order': 'error',
        '@tanstack/query/mutation-property-order': 'error',
      },
    },
  ];
});
