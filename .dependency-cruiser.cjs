/**
 * Dependency Cruiser Configuration
 *
 * Imports auto-generated rules from .safeword/depcruise-config.js
 * ADD YOUR CUSTOM RULES BELOW the spread operator.
 */

const generated = require('./.safeword/depcruise-config.cjs');

module.exports = {
  forbidden: [
    ...generated.forbidden,

    // === CLI PACKAGE ARCHITECTURE ===

    // Commands cannot import other commands (except setup → sync-config)
    {
      name: 'cli-no-cross-command-imports',
      severity: 'error',
      comment: 'Commands should be independent; extract shared logic to utils',
      from: { path: '^packages/cli/src/commands/' },
      to: {
        path: '^packages/cli/src/commands/',
        pathNot: String.raw`^packages/cli/src/commands/sync-config\.ts$`,
      },
    },

    // Lower modules cannot import commands
    {
      name: 'cli-packs-no-command-imports',
      severity: 'error',
      comment: 'Packs are libraries; cannot depend on CLI commands',
      from: { path: '^packages/cli/src/packs/' },
      to: { path: '^packages/cli/src/commands/' },
    },
    {
      name: 'cli-utils-no-command-imports',
      severity: 'error',
      comment: 'Utils are shared libraries; cannot depend on CLI commands',
      from: { path: '^packages/cli/src/utils/' },
      to: { path: '^packages/cli/src/commands/' },
    },
    {
      name: 'cli-templates-no-command-imports',
      severity: 'error',
      comment: 'Templates are content generators; cannot depend on CLI commands',
      from: { path: '^packages/cli/src/templates/' },
      to: { path: '^packages/cli/src/commands/' },
    },

    // Presets must be self-contained (for external publishability)
    {
      name: 'cli-presets-self-contained',
      severity: 'error',
      comment: 'ESLint presets must be self-contained for external use',
      from: { path: '^packages/cli/src/presets/' },
      to: {
        path: '^packages/cli/src/',
        pathNot: ['^packages/cli/src/presets/', String.raw`^packages/cli/src/version\.ts$`],
      },
    },

    // Language packs cannot cross-import
    {
      name: 'cli-golang-pack-isolated',
      severity: 'error',
      comment: 'Language packs must be independent',
      from: { path: '^packages/cli/src/packs/golang/' },
      to: { path: '^packages/cli/src/packs/(python|rust|typescript)/' },
    },
    {
      name: 'cli-python-pack-isolated',
      severity: 'error',
      comment: 'Language packs must be independent',
      from: { path: '^packages/cli/src/packs/python/' },
      to: { path: '^packages/cli/src/packs/(golang|rust|typescript)/' },
    },
    {
      name: 'cli-rust-pack-isolated',
      severity: 'error',
      comment: 'Language packs must be independent',
      from: { path: '^packages/cli/src/packs/rust/' },
      to: { path: '^packages/cli/src/packs/(golang|python|typescript)/' },
    },
    {
      name: 'cli-typescript-pack-isolated',
      severity: 'error',
      comment: 'Language packs must be independent',
      from: { path: '^packages/cli/src/packs/typescript/' },
      to: { path: '^packages/cli/src/packs/(golang|python|rust)/' },
    },

    // Packs cannot use presets
    {
      name: 'cli-packs-no-preset-imports',
      severity: 'error',
      comment: 'Packs should not depend on ESLint presets',
      from: { path: '^packages/cli/src/packs/' },
      to: { path: '^packages/cli/src/presets/' },
    },

    // Utils: only project-detector can import presets/detect
    {
      name: 'cli-utils-limited-preset-access',
      severity: 'error',
      comment: 'Only project-detector.ts can import presets/detect.ts',
      from: {
        path: '^packages/cli/src/utils/',
        pathNot: String.raw`^packages/cli/src/utils/project-detector\.ts$`,
      },
      to: { path: '^packages/cli/src/presets/' },
    },
  ],
  options: {
    ...generated.options,
    exclude: {
      path: [
        ...generated.options.exclude.path,
        // Templates are copied to target projects, not imported
        'packages/cli/templates/',
        // Build/dev scripts, not production code
        'scripts/',
        // Astro generates this directory
        '\\.astro/',
      ],
    },
  },
};
