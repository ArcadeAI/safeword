/**
 * Configuration templates - ESLint config generation and hook settings
 *
 * ESLint flat config (v9+) using safeword for all rules.
 * Framework detection uses safeword.detect utilities at runtime.
 *
 * See: https://eslint.org/docs/latest/use/configure/configuration-files
 */

// ============================================================================
// Shared ESLint Rule Definitions (for template interpolation)
// ============================================================================

/**
 * Get Prettier-related imports and config entries based on whether project has existing formatter.
 * Avoids repetition across ESLint config generators.
 */
function getPrettierConfig(hasExistingFormatter: boolean): {
  import: string;
  configEntry: string;
} {
  if (hasExistingFormatter) {
    return { import: '', configEntry: '' };
  }
  return {
    // Prettier config is bundled with safeword - no separate import needed
    import: 'const eslintConfigPrettier = safeword.prettierConfig;',
    configEntry: '  eslintConfigPrettier,',
  };
}

/**
 * Generate monorepo detection snippet for ESLint configs.
 * Extracts duplicated logic for detecting Next.js apps and scoping rules.
 *
 * @param directoryVariable - Variable name for the root directory (e.g., '__dirname' or 'projectDir')
 */
function getMonorepoSnippet(directoryVariable: string): string {
  return `// Monorepo support: detect Next.js apps to scope Next.js-only rules
// - Returns undefined for single-app Next.js projects (use full Next config)
// - Returns string[] of glob patterns for monorepos (scope Next.js rules)
const nextPaths = detect.findNextConfigPaths(${directoryVariable});

// Map framework to base config
// Note: Astro config only lints .astro files, so we combine it with TypeScript config
// to also lint .ts files in Astro projects
// Note: In monorepos, Next.js uses React config + scoped Next.js rules
const baseConfigs = {
  next: nextPaths ? configs.recommendedTypeScriptReact : configs.recommendedTypeScriptNext,
  react: configs.recommendedTypeScriptReact,
  astro: [...configs.recommendedTypeScript, ...configs.astro],
  typescript: configs.recommendedTypeScript,
  javascript: configs.recommended,
};

// Build scoped Next.js rules for monorepos
// Each Next.js app gets its own scoped config with files: pattern
const scopedNextConfigs = nextPaths?.flatMap((filePath) =>
  configs.nextOnlyRules.map((config) => ({ ...config, files: [filePath] }))
) ?? [];`;
}

/**
 * Shared optional configs snippet for ESLint templates.
 * Testing, Storybook, and conditional framework configs.
 * Used by all 3 ESLint config generators.
 */
const OPTIONAL_CONFIGS_SNIPPET = `  // Testing configs - only if detected (plugins have framework peer deps)
  ...(detect.hasVitest(deps) ? configs.vitest : []),
  ...(detect.hasPlaywright(deps) ? configs.playwright : []),
  // Storybook - only if detected (v10+ requires storybook peer dep)
  ...(detect.hasStorybook(deps) ? configs.storybook : []),
  // TanStack Query - only if detected (has typescript peer dep)
  ...(detect.hasTanstackQuery(deps) ? configs.tanstackQuery : []),
  // Tailwind - only if detected (plugin needs tailwind config to validate classes)
  ...(detect.hasTailwind(deps) ? configs.tailwind : []),
  // Turborepo - only if detected (validates env vars are declared in turbo.json)
  ...(detect.hasTurbo(deps) ? configs.turbo : []),`;

/**
 * Full strict rules for safeword ESLint configs that extend existing project configs.
 * These rules are applied after project rules (safeword wins on conflict).
 * Used by: getSafewordEslintConfigExtending, getSafewordEslintConfigLegacy
 */
const SAFEWORD_STRICT_RULES_FULL = `// Safeword strict rules - applied after project rules (win on conflict)
const safewordStrictRules = {
  rules: {
    // Prevent common LLM mistakes
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-undef": "error",
    "no-unreachable": "error",
    "no-constant-condition": "error",
    "no-empty": "error",
    "no-extra-semi": "error",
    "no-func-assign": "error",
    "no-import-assign": "error",
    "no-invalid-regexp": "error",
    "no-irregular-whitespace": "error",
    "no-loss-of-precision": "error",
    "no-misleading-character-class": "error",
    "no-prototype-builtins": "error",
    "no-unexpected-multiline": "error",
    "no-unsafe-finally": "error",
    "no-unsafe-negation": "error",
    "use-isnan": "error",
    "valid-typeof": "error",
    // Strict code quality
    "eqeqeq": ["error", "always", { null: "ignore" }],
    "no-var": "error",
    "prefer-const": "error",
  },
};`;

/**
 * Generates an ESLint config using safeword.
 *
 * The generated config uses safeword.detect utilities to detect frameworks
 * and select the appropriate config at lint time.
 * @param hasExistingFormatter - If true, generates a minimal config without Prettier
 * @returns ESLint config file content as a string
 */
export function getEslintConfig(hasExistingFormatter = false): string {
  if (hasExistingFormatter) {
    return getFormatterAgnosticEslintConfig();
  }
  return getStandardEslintConfig();
}

/**
 * Standard ESLint config - full linting with Prettier
 */
function getStandardEslintConfig(): string {
  return `import safeword from "safeword/eslint";

// Prettier config is bundled with safeword
const eslintConfigPrettier = safeword.prettierConfig;

const { detect, configs } = safeword;
const __dirname = import.meta.dirname;
const deps = detect.collectAllDeps(__dirname);
const framework = detect.detectFramework(deps);

${getMonorepoSnippet('__dirname')}

export default [
  { ignores: detect.getIgnores() },
  ...baseConfigs[framework],
  ...scopedNextConfigs,
${OPTIONAL_CONFIGS_SNIPPET}
  eslintConfigPrettier,
];
`;
}

/**
 * Formatter-agnostic ESLint config - minimal config for projects with existing formatter.
 * Used alongside external formatters (Biome, dprint, etc.) that handle formatting.
 * Does not include eslint-config-prettier since another tool handles formatting.
 */
function getFormatterAgnosticEslintConfig(): string {
  return `import safeword from "safeword/eslint";

const { detect, configs } = safeword;
const __dirname = import.meta.dirname;
const deps = detect.collectAllDeps(__dirname);
const framework = detect.detectFramework(deps);

${getMonorepoSnippet('__dirname')}

export default [
  { ignores: detect.getIgnores() },
  ...baseConfigs[framework],
  ...scopedNextConfigs,
${OPTIONAL_CONFIGS_SNIPPET}
];
`;
}

/**
 * Generates an ESLint config for .safeword/eslint.config.mjs
 * This config is used by hooks for LLM enforcement with stricter rules.
 *
 * @param existingConfig - Path to existing ESLint config (e.g., 'eslint.config.mjs' or '.eslintrc.json')
 * @param hasExistingFormatter - If true, skip eslint-config-prettier
 * @returns ESLint config file content as a string
 */
export function getSafewordEslintConfig(
  existingConfig: string | undefined,
  hasExistingFormatter = false,
): string {
  if (existingConfig) {
    // Check if it's a legacy config (.eslintrc.*)
    if (existingConfig.startsWith('.eslintrc')) {
      return getSafewordEslintConfigLegacy(existingConfig, hasExistingFormatter);
    }
    return getSafewordEslintConfigExtending(existingConfig, hasExistingFormatter);
  }

  // No existing config - generate standalone (same as project-level)
  return getSafewordEslintConfigStandalone(hasExistingFormatter);
}

/**
 * Safeword ESLint config that extends a flat config (eslint.config.mjs)
 */
function getSafewordEslintConfigExtending(
  existingConfig: string,
  hasExistingFormatter: boolean,
): string {
  const prettier = getPrettierConfig(hasExistingFormatter);
  // Need safeword import only when using prettier (for safeword.prettierConfig)
  const safewordImport = hasExistingFormatter ? '' : 'import safeword from "safeword/eslint";\n';

  return `// Safeword ESLint config - extends project config with stricter rules
// Used by hooks for LLM enforcement. Human pre-commits use project config.
// Re-run \`safeword upgrade\` to regenerate after project config changes.
${safewordImport}${prettier.import}

let projectConfig = [];
try {
  projectConfig = (await import("../${existingConfig}")).default;
  // Ensure it's an array
  if (!Array.isArray(projectConfig)) {
    projectConfig = [projectConfig];
  }
} catch (e) {
  console.warn("Safeword: Could not load project ESLint config, using defaults only");
}

${SAFEWORD_STRICT_RULES_FULL}

export default [
  ...projectConfig,
  safewordStrictRules,
${prettier.configEntry}
];
`;
}

/**
 * Safeword ESLint config that extends a legacy config (.eslintrc.*)
 */
function getSafewordEslintConfigLegacy(
  existingConfig: string,
  hasExistingFormatter: boolean,
): string {
  const prettier = getPrettierConfig(hasExistingFormatter);
  // Need safeword import only when using prettier (for safeword.prettierConfig)
  const safewordImport = hasExistingFormatter ? '' : 'import safeword from "safeword/eslint";\n';

  return `// Safeword ESLint config - extends legacy project config with stricter rules
// Used by hooks for LLM enforcement. Human pre-commits use project config.
// NOTE: Legacy .eslintrc.* format is deprecated. Consider migrating to eslint.config.mjs
import { FlatCompat } from "@eslint/eslintrc";
${safewordImport}${prettier.import}

console.warn("Safeword: Legacy .eslintrc.* detected. Consider migrating to eslint.config.mjs");

const __dirname = import.meta.dirname;
// baseDirectory is .safeword/, so ../${existingConfig} resolves to project root
const compat = new FlatCompat({ baseDirectory: __dirname });

let projectConfig = [];
try {
  projectConfig = compat.extends("../${existingConfig}");
} catch (e) {
  console.warn("Safeword: Could not load project ESLint config, using defaults only");
}

${SAFEWORD_STRICT_RULES_FULL}

export default [
  ...projectConfig,
  safewordStrictRules,
${prettier.configEntry}
];
`;
}

/**
 * Standalone safeword ESLint config (no project config to extend)
 */
function getSafewordEslintConfigStandalone(hasExistingFormatter: boolean): string {
  const prettier = getPrettierConfig(hasExistingFormatter);

  return `// Safeword ESLint config - standalone (no project config to extend)
// Used by hooks for LLM enforcement.
import { dirname } from "node:path";
import safeword from "safeword/eslint";
${prettier.import}

const { detect, configs } = safeword;
const __dirname = import.meta.dirname;
// Look in parent directory for deps (this file is in .safeword/)
const projectDir = dirname(__dirname);
const deps = detect.collectAllDeps(projectDir);
const framework = detect.detectFramework(deps);

${getMonorepoSnippet('projectDir')}

${SAFEWORD_STRICT_RULES_FULL}

export default [
  { ignores: detect.getIgnores() },
  ...baseConfigs[framework],
  ...scopedNextConfigs,
${OPTIONAL_CONFIGS_SNIPPET}
  safewordStrictRules,
${prettier.configEntry}
];
`;
}

// Cursor hooks configuration (.cursor/hooks.json format)
// See: https://cursor.com/docs/agent/hooks
// Note: Cursor runs hooks from the workspace root, so use ./ prefix
export const CURSOR_HOOKS = {
  afterFileEdit: [{ command: 'bun ./.safeword/hooks/cursor/after-file-edit.ts' }],
  stop: [{ command: 'bun ./.safeword/hooks/cursor/stop.ts' }],
};

// Claude Code hooks configuration (.claude/settings.json format)

const HOOKS_DIR = '"$CLAUDE_PROJECT_DIR"/.safeword/hooks';

/** Create a hook entry that runs a script with no matcher (SessionStart, UserPromptSubmit, Stop) */
function hook(command: string) {
  return { hooks: [{ type: 'command', command }] };
}

/** Create a hook entry with a tool matcher (PreToolUse, PostToolUse) */
function matchedHook(matcher: string, command: string) {
  return { matcher, hooks: [{ type: 'command', command }] };
}

const EDIT_TOOLS = 'Edit|Write|MultiEdit|NotebookEdit';

export const SETTINGS_HOOKS = {
  SessionStart: [
    hook(`bash ${HOOKS_DIR}/session-bun-check.sh`),
    hook(`bun ${HOOKS_DIR}/session-verify-agents.ts`),
    hook(`bun ${HOOKS_DIR}/session-version.ts`),
    hook(`bun ${HOOKS_DIR}/session-lint-check.ts`),
    matchedHook('compact', `bun ${HOOKS_DIR}/session-compact-context.ts`),
  ],
  UserPromptSubmit: [
    hook(`bun ${HOOKS_DIR}/prompt-timestamp.ts`),
    hook(`bun ${HOOKS_DIR}/prompt-questions.ts`),
  ],
  Stop: [hook(`bun ${HOOKS_DIR}/stop-quality.ts`)],
  PreToolUse: [
    matchedHook(EDIT_TOOLS, `bun ${HOOKS_DIR}/pre-tool-quality.ts`),
    matchedHook(EDIT_TOOLS, `bun ${HOOKS_DIR}/pre-tool-config-guard.ts`),
  ],
  PostToolUse: [
    matchedHook(EDIT_TOOLS, `bun ${HOOKS_DIR}/post-tool-lint.ts`),
    matchedHook(`${EDIT_TOOLS}|Bash`, `bun ${HOOKS_DIR}/post-tool-quality.ts`),
    matchedHook(EDIT_TOOLS, `bun ${HOOKS_DIR}/post-tool-bypass-warn.ts`),
  ],
  SessionEnd: [hook(`bun ${HOOKS_DIR}/session-cleanup-quality.ts`)],
};
