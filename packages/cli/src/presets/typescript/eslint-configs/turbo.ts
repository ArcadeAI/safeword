/**
 * ESLint configuration for Turborepo projects
 *
 * Ensures environment variables used in code are declared in turbo.json
 * for proper cache invalidation.
 *
 * @see https://turbo.build/repo/docs/reference/eslint-plugin-turbo
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */

import { createRequire } from 'node:module';

import { lazyConfigArray } from './lazy.js';

const requireFromHere = createRequire(import.meta.url);

/**
 * Turborepo env var validation config
 *
 * Uses official flat/recommended preset (already at error severity).
 * Catches undeclared env vars that would break Turborepo caching.
 * Plugin is loaded lazily — only when this config is actually accessed.
 */
export const turboConfig: any[] = lazyConfigArray(() => {
  const turboPlugin = requireFromHere('eslint-plugin-turbo');
  return [turboPlugin.configs?.['flat/recommended']].filter(Boolean);
});
