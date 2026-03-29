/**
 * ESLint configuration for Turborepo projects
 *
 * Ensures environment variables used in code are declared in turbo.json
 * for proper cache invalidation.
 *
 * @see https://turbo.build/repo/docs/reference/eslint-plugin-turbo
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */

import turboPlugin from 'eslint-plugin-turbo';

/**
 * Turborepo env var validation config
 *
 * Uses official flat/recommended preset (already at error severity).
 * Catches undeclared env vars that would break Turborepo caching.
 */
export const turboConfig: any[] = [turboPlugin.configs?.['flat/recommended']].filter(Boolean);
