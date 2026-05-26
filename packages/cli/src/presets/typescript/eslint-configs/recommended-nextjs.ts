/**
 * Recommended ESLint configuration for Next.js + TypeScript + LLM coding agents
 *
 * Extends the React config with Next.js-specific rules:
 * - @next/eslint-plugin-next: Framework rules (Image, Link, Head, etc.)
 *
 * Philosophy: LLMs make Next.js-specific mistakes. All rules at error severity.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */

import { createRequire } from 'node:module';

import { lazyConfigArray } from './lazy.js';
import { recommendedTypeScriptReact } from './recommended-react.js';

const requireFromHere = createRequire(import.meta.url);

/**
 * Next.js-only rules for monorepo scoping
 *
 * Contains ONLY Next.js-specific ESLint rules without React rules.
 * Use with `files:` scoping in monorepos where only some packages use Next.js,
 * while React rules apply to all React packages.
 *
 * Plugin is loaded lazily — only when this config is actually accessed.
 */
export const nextOnlyRules: any[] = lazyConfigArray(() => {
  const nextPlugin = requireFromHere('@next/eslint-plugin-next');
  return [
    // Next.js plugin with core-web-vitals config (stricter)
    nextPlugin.configs['core-web-vitals'],

    // Escalate ALL remaining warn rules to error (LLMs ignore warnings)
    {
      name: 'safeword/nextjs-rules',
      rules: {
        '@next/next/google-font-display': 'error',
        '@next/next/google-font-preconnect': 'error',
        '@next/next/next-script-for-ga': 'error',
        '@next/next/no-async-client-component': 'error',
        '@next/next/no-before-interactive-script-outside-document': 'error',
        '@next/next/no-css-tags': 'error',
        '@next/next/no-head-element': 'error',
        '@next/next/no-img-element': 'error',
        '@next/next/no-page-custom-font': 'error',
        '@next/next/no-styled-jsx-in-document': 'error',
        '@next/next/no-title-in-document-head': 'error',
        '@next/next/no-typos': 'error',
        '@next/next/no-unwanted-polyfillio': 'error',
      },
    },
  ];
});

/**
 * Next.js + TypeScript recommended config
 *
 * Extends React config with Next.js-specific rules for catching
 * common LLM mistakes: using <img> instead of <Image>, <a> instead of <Link>.
 *
 * Plugin loads lazily through `nextOnlyRules` — accessing this triggers the
 * Next.js plugin require, but only because the spread reaches into nextOnlyRules.
 */
export const recommendedTypeScriptNext: any[] = lazyConfigArray(() => [
  // All React + TypeScript rules
  ...recommendedTypeScriptReact,

  // Next.js-only rules (spreading triggers the lazy load above)
  ...nextOnlyRules,
]);
