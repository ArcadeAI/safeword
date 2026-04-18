/**
 * Safeword Monorepo ESLint Configuration
 *
 * Uses safeword presets for all rules.
 * Package isolation enforced by dependency-cruiser (see .dependency-cruiser.cjs).
 */

import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';

import safeword from './packages/cli/dist/presets/typescript/index.js';

// Ignores
const ignores = [
  '**/node_modules/',
  '**/dist/',
  '**/build/',
  '**/coverage/',
  '**/.astro/', // Astro generated types - not our code
  '**/.safeword/', // Generated hooks - linted separately by installed safeword config
  '.safeword-project/', // Project-specific hooks - not part of distributed package
  'examples/',
  'eslint.config.mjs', // Self - JS file can't use typed rules
  'packages/cli/templates/', // Template files copied to customer projects - not part of CLI build
  '**/.dependency-cruiser.cjs', // CommonJS config file
  'packages/cli/scripts/*.js', // Node.js scripts with CommonJS globals
  'scripts/', // Monorepo dev scripts - standalone Bun scripts not in any tsconfig
];

export default defineConfig([
  { ignores },
  ...safeword.configs.recommendedTypeScript,
  ...safeword.configs.vitest,
  ...safeword.configs.playwright,
  eslintConfigPrettier,

  // Config files override - dynamic imports, untyped module loads
  {
    name: 'config-files-override',
    files: ['*.config.mjs', '*.config.ts', '.safeword/*.mjs', 'packages/*/tsup.config.ts'],
    extends: [safeword.configs.relaxedTypes],
  },

  // CLI package overrides - disable false positives for CLI tools
  {
    name: 'cli-package-override',
    files: ['packages/cli/**/*.ts', 'packages/cli/**/*.mjs'],
    extends: [safeword.configs.cli, safeword.configs.relaxedTypes],
    rules: {
      // JSDoc not required for internal CLI code
      'jsdoc/require-param': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-jsdoc': 'off',
      // Interface conformance sometimes requires async without await
      '@typescript-eslint/require-await': 'off',
    },
  },

  // CLI tests overrides (includes co-located unit tests in src/)
  {
    name: 'cli-tests-override',
    files: ['packages/cli/tests/**/*.ts', 'packages/cli/src/**/*.test.ts'],
    rules: {
      'sonarjs/no-unused-vars': 'off',
      'sonarjs/no-dead-store': 'off',
      'sonarjs/unused-import': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'sonarjs/slow-regex': 'off',
      'security/detect-unsafe-regex': 'off',
      'sonarjs/assertions-in-tests': 'off',
      'sonarjs/no-nested-functions': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'sonarjs/publicly-writable-directories': 'off',
      'sonarjs/no-alphabetical-sort': 'off',
      'regexp/no-dupe-disjunctions': 'off',
      // Test helpers often use callback references
      'unicorn/no-array-callback-reference': 'off',
      // Raise threshold for tests (base.ts uses max:3, too strict for test patterns)
      'max-nested-callbacks': ['error', { max: 6 }],
    },
  },

  // ESLint RuleTester files - use dynamic test generation
  {
    name: 'ruletester-files-override',
    files: ['packages/cli/src/presets/typescript/eslint-rules/__tests__/*.ts'],
    rules: {
      // RuleTester.run() generates tests dynamically - sonarjs can't detect them
      'sonarjs/no-empty-test-file': 'off',
    },
  },

  // Website package overrides - Astro has virtual modules and special patterns
  {
    name: 'website-package-override',
    files: [
      'packages/website/**/*.ts',
      'packages/website/**/*.tsx',
      'packages/website/**/*.astro',
      'packages/website/**/*.mjs',
    ],
    extends: [safeword.configs.relaxedTypes],
    rules: {
      // Astro virtual modules (astro:content, @astrojs/starlight/*)
      'import-x/no-unresolved': 'off',
    },
  },
]);
