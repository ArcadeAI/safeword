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
import { parser as typescriptParser } from 'typescript-eslint';

import { basePlugins, CUCUMBER_TYPESCRIPT_STEP_GLOBS, prettierConfig } from './base.js';

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

  // Safeword's BDD steps are TypeScript even in a JavaScript project: parse them
  // with the TypeScript parser (syntax only, no type-checked rules).
  {
    name: 'safeword/typescript-step-files',
    files: CUCUMBER_TYPESCRIPT_STEP_GLOBS,
    languageOptions: { parser: typescriptParser },
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
