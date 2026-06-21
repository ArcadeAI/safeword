/**
 * CLI package ESLint configuration — dogfoods our own presets directly from
 * source so linting does not depend on the package's built output. ESLint
 * loads `.ts` configs via `jiti` on Node (declared as a direct dev dep) or
 * natively on Bun. See ticket #147.
 */

import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';

import safeword from './src/presets/typescript/index.js';

const { detect, configs } = safeword;
const dependencies = detect.collectAllDeps(import.meta.dirname);
const framework = detect.detectFramework(dependencies);

// Map framework to base config
// Note: Astro config only lints .astro files, so we combine it with TypeScript config
// to also lint .ts files in Astro projects
const baseConfigs = {
  next: configs.recommendedTypeScriptNext,
  react: configs.recommendedTypeScriptReact,
  astro: [...configs.recommendedTypeScript, ...configs.astro],
  typescript: configs.recommendedTypeScript,
  javascript: configs.recommended,
};

export default defineConfig([
  { ignores: detect.getIgnores() },

  ...baseConfigs[framework],
  ...(detect.hasVitest(dependencies) ? configs.vitest : []),
  ...(detect.hasPlaywright(dependencies) ? configs.playwright : []),
  ...(detect.hasTailwind(dependencies) ? configs.tailwind : []),
  ...(detect.hasTanstackQuery(dependencies) ? configs.tanstackQuery : []),
  configs.cli,
  configs.relaxedTypes,
  eslintConfigPrettier,
]);
