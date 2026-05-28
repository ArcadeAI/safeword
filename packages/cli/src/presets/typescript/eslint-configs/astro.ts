/**
 * ESLint configuration for Astro projects
 *
 * Applies to .astro files.
 * Includes recommended rules plus LLM-critical security/convention rules.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */

import { createRequire } from 'node:module';

import { lazyConfigArray } from './lazy.js';

const requireFromHere = createRequire(import.meta.url);

/**
 * Astro config
 *
 * Includes:
 * - 8 recommended rules (all at error)
 * - 33 accessibility rules from jsx-a11y-strict (adapted for Astro)
 * - 3 LLM-critical rules: no-set-html-directive (XSS), no-unsafe-inline-scripts (CSP), no-exports-from-components
 *
 * Note: jsx-a11y rules work with Astro files because eslint-plugin-astro
 * provides wrapped versions that understand Astro's JSX-like syntax.
 * Using eslint-plugin-jsx-a11y directly on Astro files does NOT work.
 *
 * Plugin is loaded lazily — only when this config is actually accessed.
 */
export const astroConfig: any[] = lazyConfigArray(() => {
  const astroPlugin = requireFromHere('eslint-plugin-astro');
  return [
    // Spread flat/recommended (5 config objects: plugin setup, file patterns, prettier overrides, rules)
    ...astroPlugin.configs['flat/recommended'],

    // Accessibility rules adapted for Astro (requires eslint-plugin-jsx-a11y installed)
    ...astroPlugin.configs['flat/jsx-a11y-strict'],

    // Add LLM-critical rules
    {
      name: 'safeword/astro',
      rules: {
        // XSS prevention - LLMs often use set:html for rendering user content
        'astro/no-set-html-directive': 'error',

        // CSP safety - inline scripts can break Content Security Policy
        'astro/no-unsafe-inline-scripts': 'error',

        // Astro convention - LLMs try to export from .astro components (not allowed)
        'astro/no-exports-from-components': 'error',
      },
    },
  ];
});
