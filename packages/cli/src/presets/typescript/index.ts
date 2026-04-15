/**
 * TypeScript Preset
 *
 * ESLint configs, rules, and detection for TypeScript/JavaScript projects.
 * This is the main entry point for the TypeScript language preset.
 *
 * Usage in user's eslint.config.mjs:
 *   import safeword from 'safeword/eslint';
 *   export default [...safeword.configs.recommendedTypeScript];
 *
 * Or with multiple configs:
 *   import safeword from 'safeword/eslint';
 *   export default [
 *     ...safeword.configs.recommendedTypeScript,
 *     ...safeword.configs.vitest,
 *   ];
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */

import type { Rule } from 'eslint';

import { VERSION } from '../../version.js';
import { detect } from './detect.js';
import { astroConfig } from './eslint-configs/astro.js';
import { prettierConfig } from './eslint-configs/base.js';
import { cliOverrides } from './eslint-configs/overrides-cli.js';
import { relaxedTypesOverrides } from './eslint-configs/overrides-relaxed-types.js';
import { playwrightConfig } from './eslint-configs/playwright.js';
import { recommended } from './eslint-configs/recommended.js';
import { nextOnlyRules, recommendedTypeScriptNext } from './eslint-configs/recommended-nextjs.js';
import { recommendedTypeScriptReact } from './eslint-configs/recommended-react.js';
import { recommendedTypeScript } from './eslint-configs/recommended-typescript.js';
import { storybookConfig } from './eslint-configs/storybook.js';
import { tailwindConfig } from './eslint-configs/tailwind.js';
import { tanstackQueryConfig } from './eslint-configs/tanstack-query.js';
import { turboConfig } from './eslint-configs/turbo.js';
import { vitestConfig } from './eslint-configs/vitest.js';
import { rules } from './eslint-rules/index.js';

interface SafewordEslint {
  meta: {
    name: string;
    version: string;
  };
  configs: {
    recommended: any[];
    recommendedTypeScript: any[];
    recommendedTypeScriptReact: any[];
    recommendedTypeScriptNext: any[];
    /** Next.js-only rules for monorepo file scoping */
    nextOnlyRules: any[];
    astro: any[];
    tailwind: any[];
    tanstackQuery: any[];
    vitest: any[];
    playwright: any[];
    storybook: any[];
    turbo: any[];
  };
  /** Override presets for common false-positive categories */
  overrides: {
    /** Security rules that are false positives for CLI tools, build tools, and scripts */
    cli: any;
    /** Strict TypeScript rules that conflict with untyped external data (JSON, YAML, APIs) */
    relaxedTypes: any;
  };
  detect: typeof detect;
  rules: Record<string, Rule.RuleModule>;
  /** eslint-config-prettier, bundled for convenience */
  prettierConfig: any;
}

/**
 * ESLint plugin structure for TypeScript preset.
 * Can be used directly as an ESLint plugin or via safeword.eslint.
 */
export const eslintPlugin: SafewordEslint = {
  meta: {
    name: 'safeword',
    version: VERSION,
  },
  configs: {
    recommended,
    recommendedTypeScript,
    recommendedTypeScriptReact,
    recommendedTypeScriptNext,
    nextOnlyRules,
    astro: astroConfig,
    tailwind: tailwindConfig,
    tanstackQuery: tanstackQueryConfig,
    vitest: vitestConfig,
    playwright: playwrightConfig,
    storybook: storybookConfig,
    turbo: turboConfig,
  },
  overrides: {
    cli: cliOverrides,
    relaxedTypes: relaxedTypesOverrides,
  },
  detect,
  rules,
  prettierConfig,
};

// Re-export configs for direct access
export { detect } from './detect.js';
export { astroConfig } from './eslint-configs/astro.js';
export { prettierConfig } from './eslint-configs/base.js';
export { cliOverrides } from './eslint-configs/overrides-cli.js';
export { relaxedTypesOverrides } from './eslint-configs/overrides-relaxed-types.js';
export { playwrightConfig } from './eslint-configs/playwright.js';
export { recommended } from './eslint-configs/recommended.js';
export { nextOnlyRules, recommendedTypeScriptNext } from './eslint-configs/recommended-nextjs.js';
export { recommendedTypeScriptReact } from './eslint-configs/recommended-react.js';
export { recommendedTypeScript } from './eslint-configs/recommended-typescript.js';
export { storybookConfig } from './eslint-configs/storybook.js';
export { tailwindConfig } from './eslint-configs/tailwind.js';
export { tanstackQueryConfig } from './eslint-configs/tanstack-query.js';
export { turboConfig } from './eslint-configs/turbo.js';
export { vitestConfig } from './eslint-configs/vitest.js';
export { rules } from './eslint-rules/index.js';

// Default export for `import safeword from "safeword/eslint"`
export default eslintPlugin;
