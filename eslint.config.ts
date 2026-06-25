/**
 * Safeword Monorepo ESLint Configuration
 *
 * Uses safeword presets for all rules.
 * Package isolation enforced by dependency-cruiser (see .dependency-cruiser.cjs).
 *
 * This config is `.ts` so it can import safeword presets directly from source
 * (`packages/cli/src/...`) instead of built output (`dist/`). Lint no longer
 * requires a prior `bun run build`, so fresh worktrees can commit after a
 * single `bun install`. ESLint loads `.ts` configs via `jiti` on Node (declared
 * as a direct dev dep) or natively on Bun. See ticket #147.
 */

import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';

import safeword from './packages/cli/src/presets/typescript/index.js';

const tsconfigRootDirectory = import.meta.dirname;

// Ignores
const ignores = [
  '**/node_modules/',
  '**/dist/',
  '**/build/',
  '**/coverage/',
  '**/.astro/', // Astro generated types - not our code
  '**/.safeword/', // Generated hooks - linted separately by installed safeword config
  '**/.claude/worktrees/', // Stale worktree leftovers from Claude Code's worktree isolation
  '.project/', // Project namespace (was .safeword-project/) - hooks here are not part of the distributed package
  'examples/',
  'eslint.config.ts', // Self - loaded by ESLint's own pipeline, not part of the linted tree
  'packages/cli/templates/', // Template files copied to customer projects - not part of CLI build
  '**/.dependency-cruiser.cjs', // CommonJS config file
  'packages/cli/scripts/*.js', // Node.js scripts with CommonJS globals
  'scripts/', // Monorepo dev scripts - standalone Bun scripts not in any tsconfig
  'experiments/', // Research spikes - self-contained, not in any tsconfig or workspace
  'features/', // Root cucumber lane scaffolded by safeword upgrade - customer-facing, no tsconfig
  'steps/', // Root cucumber step definitions (same lane)
];

export default defineConfig([
  { ignores },
  {
    name: 'repo/typescript-parser-root',
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: tsconfigRootDirectory,
      },
    },
  },
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

  // Test-file overrides now live in safeword.configs.vitest (the shipped
  // preset) — files matching **/*.test.{ts,tsx,js,jsx}, **/*.spec.{ts,...},
  // **/tests/**/*.{ts,...}, **/e2e/**/*.{ts,...} get the laxer rule set.
  // Removed the old `cli-tests-override` block (was: rule set duplicated
  // here that wasn't reaching the workspace-level eslint.config.ts);
  // promoting into the preset closes that drift permanently.

  // ESLint RuleTester files - use dynamic test generation
  {
    name: 'ruletester-files-override',
    files: ['packages/cli/src/presets/typescript/eslint-rules/__tests__/*.ts'],
    rules: {
      // RuleTester.run() generates tests dynamically - sonarjs can't detect them
      'sonarjs/no-empty-test-file': 'off',
    },
  },

  // Cucumber step definitions — the Cucumber API binds `this` to the World in
  // `function () {}` step callbacks (arrow functions break that binding), and
  // setWorldConstructor/Given/When/Then/Before/After are top-level registration
  // side effects by design. unicorn 68's no-this-outside-of-class and
  // no-top-level-side-effects are fundamentally incompatible with that idiom.
  // (The scaffolded root `features/` lane is ignored above; this covers our own
  // packages/cli/features/ suite, which is typechecked and stays linted.)
  {
    name: 'cucumber-steps-override',
    files: ['**/features/**/*.ts'],
    rules: {
      'unicorn/no-this-outside-of-class': 'off',
      'unicorn/no-top-level-side-effects': 'off',
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
