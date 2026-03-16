import eslintConfigPrettier from 'eslint-config-prettier';

import safeword from './dist/presets/typescript/index.js';

const { detect, configs } = safeword;
const deps = detect.collectAllDeps(import.meta.dirname);
const framework = detect.detectFramework(deps);

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

// Project-specific rule overrides for CLI tools
const cliToolOverrides = {
  name: 'safeword-cli/overrides',
  rules: {
    // CLI tools intentionally execute commands from PATH - this is expected behavior.
    // The rule is for web apps where PATH manipulation is an attack vector.
    // Using absolute paths breaks cross-platform compatibility.
    'sonarjs/no-os-command-from-path': 'off',
  },
};

export default [
  { ignores: detect.getIgnores() },

  ...baseConfigs[framework],
  ...(detect.hasVitest(deps) ? configs.vitest : []),
  ...(detect.hasPlaywright(deps) ? configs.playwright : []),
  ...(detect.hasTailwind(deps) ? configs.tailwind : []),
  ...(detect.hasTanstackQuery(deps) ? configs.tanstackQuery : []),
  cliToolOverrides,
  eslintConfigPrettier,
];
