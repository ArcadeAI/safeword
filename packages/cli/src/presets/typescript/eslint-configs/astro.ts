/**
 * ESLint configuration for Astro projects
 *
 * Applies to .astro files.
 * Includes recommended rules plus LLM-critical security/convention rules.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */

import eslintPluginAstro from 'eslint-plugin-astro';

import { lazyConfigArray } from './lazy.js';
import { hasOptionalDependency } from './optional-dependency.js';

interface BuildAstroConfigOptions {
  astroPlugin?: {
    configs: Record<string, any[]>;
  };
  hasJsxA11y?: boolean;
}

/**
 * Astro config
 *
 * Includes:
 * - Astro's recommended rules (all at error)
 * - 33 accessibility rules from jsx-a11y-strict (adapted for Astro)
 * - LLM-critical rules: no-set-html-directive (XSS), no-unsafe-inline-scripts (CSP), no-exports-from-components
 *
 * Note: jsx-a11y rules work with Astro files because eslint-plugin-astro
 * provides wrapped versions that understand Astro's JSX-like syntax.
 * Using eslint-plugin-jsx-a11y directly on Astro files does NOT work.
 *
 * Config objects are assembled lazily — only when this config is actually accessed.
 */
export function buildAstroConfig({
  astroPlugin = eslintPluginAstro,
  hasJsxA11y = hasOptionalDependency('eslint-plugin-jsx-a11y'),
}: BuildAstroConfigOptions = {}): any[] {
  return [
    // Spread flat/recommended (5 config objects: plugin setup, file patterns, prettier overrides, rules)
    ...(astroPlugin.configs['flat/recommended'] ?? []),

    // Accessibility rules adapted for Astro when eslint-plugin-jsx-a11y is installed.
    ...(hasJsxA11y ? (astroPlugin.configs['flat/jsx-a11y-strict'] ?? []) : []),

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
}

export const astroConfig: any[] = lazyConfigArray(() => buildAstroConfig());
