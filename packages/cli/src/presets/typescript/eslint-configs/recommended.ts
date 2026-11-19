/**
 * Recommended ESLint configuration for JavaScript + LLM coding agents
 *
 * This preset bundles and configures multiple ESLint plugins with
 * severity levels optimized for catching common LLM-generated code issues.
 *
 * Philosophy: LLMs ignore warnings, so rules that catch real bugs are at "error".
 *
 * For TypeScript projects, use `recommendedTypeScript` instead.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */

import pluginJsdoc from 'eslint-plugin-jsdoc';
import {
  configs as tseslintConfigs,
  parser as typescriptParser,
  plugin as tseslintPlugin,
} from 'typescript-eslint';

import { basePlugins, prettierConfig } from './base.js';

/**
 * JavaScript recommended config - core plugins without TypeScript
 *
 * Note: Uses any[] because ESLint plugin types are incompatible across packages.
 * Runtime validation by ESLint ensures correctness.
 */

export const recommended: any[] = [
  // All base plugins (security, promise, unicorn, etc.)
  ...basePlugins,

  // JSDoc - JavaScript needs docs (no type safety net)
  // Using error config - LLMs ignore warnings
  pluginJsdoc.configs['flat/recommended-error'],

  // Safeword's BDD steps are TypeScript even in a JavaScript project, wherever the
  // lane lives (paths.steps can relocate it), and an app may add TypeScript
  // later. Parse every TypeScript file with the TypeScript parser (syntax only,
  // no type-checked rules), and swap the core rules that misread type-only names
  // for typescript-eslint's versions.
  {
    name: 'safeword/typescript-files',
    files: ['**/*.{ts,mts,cts}'],
    languageOptions: { parser: typescriptParser },
    plugins: { '@typescript-eslint': tseslintPlugin },
    rules: {
      ...tseslintConfigs.eslintRecommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // Prettier must be last to disable conflicting rules
  prettierConfig,

  // Re-enable curly after prettier (prettier turns it off but we want braces for LLM code)
  {
    rules: {
      curly: 'error', // Force braces on if/else/for/while - LLMs write unsafe single-line blocks
    },
  },
];
