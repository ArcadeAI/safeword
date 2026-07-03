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
  ...(detect.hasBunTest(deps, __dirname) ? configs.bunTest : []),
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
  return `import { defineConfig } from "eslint/config";
import safeword from "safeword/eslint";

// Prettier config is bundled with safeword
const eslintConfigPrettier = safeword.prettierConfig;

const { detect, configs } = safeword;
const __dirname = import.meta.dirname;
const deps = detect.collectAllDeps(__dirname);
const framework = detect.detectFramework(deps);

${getMonorepoSnippet('__dirname')}

export default defineConfig([
  { ignores: detect.getIgnores() },
  ...baseConfigs[framework],
  ...scopedNextConfigs,
${OPTIONAL_CONFIGS_SNIPPET}
  eslintConfigPrettier,
]);
`;
}

/**
 * Formatter-agnostic ESLint config - minimal config for projects with existing formatter.
 * Used alongside external formatters (Biome, dprint, etc.) that handle formatting.
 * Does not include eslint-config-prettier since another tool handles formatting.
 */
function getFormatterAgnosticEslintConfig(): string {
  return `import { defineConfig } from "eslint/config";
import safeword from "safeword/eslint";

const { detect, configs } = safeword;
const __dirname = import.meta.dirname;
const deps = detect.collectAllDeps(__dirname);
const framework = detect.detectFramework(deps);

${getMonorepoSnippet('__dirname')}

export default defineConfig([
  { ignores: detect.getIgnores() },
  ...baseConfigs[framework],
  ...scopedNextConfigs,
${OPTIONAL_CONFIGS_SNIPPET}
]);
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
  // Legacy `.eslintrc.*` path: use FlatCompat shim.
  if (existingConfig?.startsWith('.eslintrc')) {
    return getSafewordEslintConfigLegacy(existingConfig, hasExistingFormatter);
  }
  // Flat-config path. When customer has no pre-existing config, safeword's
  // managedFiles generates `eslint.config.mjs` at the project root in the same
  // setup run, so by hook execution time the file always exists. The
  // existsSync gate in the template covers the edge case (file truly missing)
  // gracefully — see ticket 139.
  return getSafewordEslintConfigExtending(
    existingConfig ?? 'eslint.config.mjs',
    hasExistingFormatter,
  );
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
import { existsSync } from "node:fs";
${safewordImport}${prettier.import}

// Ticket 139: existsSync gate + no try/catch.
// - File present, import fails → real error (syntax, missing plugin, etc.) → throw,
//   so the hook fails loud instead of silently dropping customer overrides.
// - File absent → projectConfig stays [] → hook runs with safeword defaults only.
//   In practice, safeword's managedFiles generates the project eslint.config.mjs
//   in the same setup run, so this fallback only fires in degenerate cases.
let projectConfig = [];
const projectConfigPath = new URL("../${existingConfig}", import.meta.url);

function isTypeScriptProjectConfig(configPath) {
  return /\\.[cm]?ts$/.test(configPath.pathname);
}

async function loadProjectConfig() {
  if (isTypeScriptProjectConfig(projectConfigPath)) {
    const { createJiti } = await import("jiti");
    const jiti = createJiti(import.meta.url);
    return await jiti.import(projectConfigPath.href, { default: true });
  }
  const loaded = await import("../${existingConfig}");
  return loaded.default;
}

if (existsSync(projectConfigPath)) {
  projectConfig = await loadProjectConfig();
  if (!Array.isArray(projectConfig)) {
    projectConfig = [projectConfig];
  }
}

${SAFEWORD_STRICT_RULES_FULL}

// Composition order (ticket 138): safeword rules FIRST, customer config LAST.
// Flat config is "later wins" — this makes the customer's project config
// authoritative for the LLM hook. Customer overrides (e.g. 'no-unused-vars': 'off')
// take effect here instead of being silently overridden by safeword's strict layer.
export default [
  safewordStrictRules,
  ...projectConfig,
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

// Composition order (ticket 138): safeword rules FIRST, customer config LAST.
// See getSafewordEslintConfigExtending for rationale.
export default [
  safewordStrictRules,
  ...projectConfig,
${prettier.configEntry}
];
`;
}

// Cursor hooks configuration (.cursor/hooks.json format)
// See: https://cursor.com/docs/agent/hooks
// Note: Cursor runs hooks from the workspace root, so use ./ prefix
//
// failClosed (ANAXG4): Cursor hooks default to fail-open — a hook that crashes,
// times out, or emits invalid JSON lets the action through. The BLOCKING gates
// carry `failClosed: true` so a broken gate denies instead of silently vanishing.
// OBSERVATIONAL hooks are deliberately left fail-open (the default): a crashing
// lint/state/nudge hook must never block legitimate work.
export const CURSOR_HOOKS = {
  // Observational: injects standing context and checks for auto-upgrades.
  // Fail-open — neither hook may block the session from starting.
  sessionStart: [
    { command: 'bun ./.safeword/hooks/session-safeword-context.ts --agent=cursor' },
    { command: 'bun ./.safeword/hooks/session-cursor-auto-upgrade.ts' },
  ],
  // NOTE (F2TKR3): there is deliberately NO beforeSubmitPrompt gate. That hook
  // fires at prompt-send time, where Cursor exposes only the prompt text — no tool
  // name or file path — so it cannot tell "create test-definitions.md" from "write
  // application code". A block there is a catch-22: it would stop the very prompt
  // that asks the agent to create the scenarios. The phase gate lives at the edit
  // layer below (preToolUse), which is path-aware (META_PATHS lets scenario/meta
  // files through) and session-bound — exact parity with the Claude side.
  //
  // Blocking edit gate. Matcher limits it to the `Write` tool (Cursor's only edit
  // tool) so it never spawns on Read/Grep/Task. Denies edits when a feature at the
  // implement phase has no test-definitions.md, and on LOC blast-radius overflow.
  //
  // Done gate (AKNWZK): this same hook also enforces the done gate. Cursor's `stop`
  // cannot block, so closing a ticket is gated here — a Write that flips ticket.md to
  // `status: done` is denied unless the evidence holds (tests green, verify.md in
  // scope, scenarios complete). That makes done the only edit that runs the test
  // suite, so the timeout is raised to cover a full run (the suite self-caps at 60s).
  preToolUse: [
    {
      command: 'bun ./.safeword/hooks/cursor/pre-tool-quality.ts',
      matcher: 'Write',
      failClosed: true,
      timeout: 90,
    },
  ],
  // Blocking commit gate (a REFACTOR commit may not touch test files). Cursor's
  // timeout is longer than the adapter's inner timeout, so Safeword can return a
  // clear denial message before Cursor falls back to opaque cancellation.
  beforeShellExecution: [
    {
      command: 'bun ./.safeword/hooks/cursor/before-shell-execution.ts',
      failClosed: true,
      timeout: 12,
    },
  ],
  // Observational: triggers lint on edited files. Fail-open — a lint crash must
  // not block the edit.
  afterFileEdit: [{ command: 'bun ./.safeword/hooks/cursor/after-file-edit.ts' }],
  // Observational: maintains the per-session quality state (LOC, commit-clears-gate,
  // ticket binding) the blocking edit gate reads. Matched to edits + shell only.
  // Fail-open — if it crashes the gate simply lacks fuel and degrades to allow,
  // which must never block work.
  postToolUse: [
    { command: 'bun ./.safeword/hooks/cursor/post-tool-quality.ts', matcher: 'Write|Shell' },
    // Observational: language-skill nudge on edits. Fail-open — emits {} on any
    // miss, never blocks. Forwards the Claude hook's additionalContext as Cursor
    // additional_context.
    { command: 'bun ./.safeword/hooks/cursor/post-tool-skill-nudge.ts', matcher: 'Write' },
  ],
  // Observational: nudges a quality review. Cursor `stop` cannot block anyway —
  // the real done enforcement lives in preToolUse (above). loop_limit:1 is
  // intentional: this is a one-shot reminder (the hook clears its edit marker after
  // firing), NOT a drive-to-done loop, so a single auto-continue is enough and a
  // higher cap would just re-nudge noisily.
  stop: [{ command: 'bun ./.safeword/hooks/cursor/stop.ts', loop_limit: 1 }],
};

// Claude Code hooks configuration (.claude/settings.json format)

const HOOKS_DIR = '"$CLAUDE_PROJECT_DIR"/.safeword/hooks';

/** Create a hook entry that runs a script with no matcher (SessionStart, UserPromptSubmit, Stop) */
function hook(command: string) {
  return { hooks: [{ type: 'command', command }] };
}

/**
 * Create a background hook that does not block session start but can still
 * surface a message: with `asyncRewake`, Claude Code runs the hook detached and
 * — only when the hook exits with code 2 — delivers its stderr to Claude as a
 * system reminder (https://code.claude.com/docs/en/hooks). Used by the
 * auto-upgrade hook so a pending upgrade never stalls session start, yet
 * "upgraded" / "major available" / "blocked" messages still reach the user.
 * Degrades safely: a Claude Code build that doesn't know the flag treats the
 * entry as an ordinary (synchronous) hook — i.e. today's blocking behavior.
 */
function asyncRewakeHook(command: string) {
  return { hooks: [{ type: 'command', command, asyncRewake: true }] };
}

/**
 * Create a fully backgrounded hook with `async: true` (documented Claude Code
 * mode, https://code.claude.com/docs/en/hooks): the hook returns IMMEDIATELY and
 * its whole process tree runs in the background (up to 600s), so it never blocks.
 * Unlike `asyncRewake`, it surfaces NOTHING back into the conversation — used by
 * the invisible retro (ZFGWS1) so repeated delta fires stay non-blocking AND
 * invisible. Degrades safely: a build that doesn't know `async` treats it as an
 * ordinary (synchronous) hook.
 */
function asyncHook(command: string) {
  return { hooks: [{ type: 'command', command, async: true }] };
}

/** Create a hook entry with a tool matcher (PreToolUse, PostToolUse) */
function matchedHook(matcher: string, command: string) {
  return { matcher, hooks: [{ type: 'command', command }] };
}

/**
 * Create a hook entry with a tool matcher AND an `if` permission-rule filter.
 *
 * The `if` field uses Claude Code's permission-rule syntax (e.g., `Bash(git *)`)
 * and is evaluated BEFORE spawning the hook process, so non-matching tool calls
 * incur zero overhead. See https://code.claude.com/docs/en/hooks.
 */
function matchedHookWithIf(matcher: string, ifRule: string, command: string) {
  return {
    matcher,
    hooks: [{ type: 'command', if: ifRule, command }],
  };
}

const EDIT_TOOLS = 'Edit|Write|MultiEdit|NotebookEdit';

export const SETTINGS_HOOKS = {
  SessionStart: [
    hook(`bash ${HOOKS_DIR}/session-bun-check.sh`),
    hook(`bun ${HOOKS_DIR}/session-dependency-readiness.ts`),
    asyncRewakeHook(`bun ${HOOKS_DIR}/session-auto-upgrade.ts`),
    hook(`bun ${HOOKS_DIR}/session-safeword-context.ts --agent=claude`),
    hook(`bun ${HOOKS_DIR}/session-version.ts`),
    hook(`bun ${HOOKS_DIR}/session-lint-check.ts`),
    hook(`bun ${HOOKS_DIR}/session-architecture-heal.ts`),
    hook(`bun ${HOOKS_DIR}/session-author-model.ts`),
    hook(`bun ${HOOKS_DIR}/session-start-reentry.ts`),
    matchedHook('compact', `bun ${HOOKS_DIR}/session-safeword-context.ts --agent=claude`),
    matchedHook('compact', `bun ${HOOKS_DIR}/session-compact-context.ts`),
  ],
  UserPromptSubmit: [
    hook(`bun ${HOOKS_DIR}/prompt-timestamp.ts`),
    hook(`bun ${HOOKS_DIR}/prompt-questions.ts`),
    // Cloud-retro filing nudge (BNGK9W): when the async Stop hook spooled unfiled
    // drafts (REST 401 in cloud), surface one factual line so the agent files them.
    hook(`bun ${HOOKS_DIR}/prompt-retro-nudge.ts`),
  ],
  Stop: [
    hook(`bun ${HOOKS_DIR}/stop-quality.ts`),
    hook(`bun ${HOOKS_DIR}/stop-reentry.ts`),
    hook(`bun ${HOOKS_DIR}/stop-self-report.ts`),
    // Invisible retro (ZFGWS1): async so repeated delta fires never block Stop and
    // run fully in the background; the inner spawnSync stays sync within that tree.
    asyncHook(`bun ${HOOKS_DIR}/stop-retro.ts`),
  ],
  PreToolUse: [
    matchedHook('Bash', `bun ${HOOKS_DIR}/pre-tool-dependency-readiness.ts`),
    matchedHook(EDIT_TOOLS, `bun ${HOOKS_DIR}/pre-tool-quality.ts`),
    matchedHook(EDIT_TOOLS, `bun ${HOOKS_DIR}/pre-tool-config-guard.ts`),
    // Defends ad-hoc git ops against Claude Code's parallel-worktree
    // core.bare=true race (anthropics/claude-code#58345). `if` filters at the
    // config level so non-git Bash calls incur zero hook-process spawn.
    matchedHookWithIf('Bash', 'Bash(git *)', `bash ${HOOKS_DIR}/pre-tool-git-bare-fix.sh`),
    // Commit-time auto-fix: regenerate + stage a stale architecture doc into the
    // in-flight commit (ticket FPV0E4). `if` scopes the spawn to `git commit`, so
    // other Bash calls incur zero overhead; the hook re-checks the command too.
    matchedHookWithIf(
      'Bash',
      'Bash(git commit*)',
      `bun ${HOOKS_DIR}/pre-tool-architecture-stage.ts`,
    ),
    // Warn (never block) before a checkout/switch to a branch behind its upstream,
    // so "catch up to main" doesn't silently serve stale content (#366). `if`
    // scopes the spawn to checkout/switch; the hook re-parses the target.
    matchedHookWithIf('Bash', 'Bash(git checkout*)', `bun ${HOOKS_DIR}/pre-tool-stale-main.ts`),
    matchedHookWithIf('Bash', 'Bash(git switch*)', `bun ${HOOKS_DIR}/pre-tool-stale-main.ts`),
  ],
  PostToolUse: [
    matchedHook(EDIT_TOOLS, `bun ${HOOKS_DIR}/post-tool-lint.ts`),
    matchedHook(`${EDIT_TOOLS}|Bash`, `bun ${HOOKS_DIR}/post-tool-quality.ts`),
    matchedHook(EDIT_TOOLS, `bun ${HOOKS_DIR}/post-tool-skill-nudge.ts`),
    matchedHook(EDIT_TOOLS, `bun ${HOOKS_DIR}/post-tool-bypass-warn.ts`),
    matchedHook(EDIT_TOOLS, `bun ${HOOKS_DIR}/post-tool-sync-learnings.ts`),
    // Stamp the dependency fingerprint after a successful install so the
    // recommended recovery command clears the readiness block (#380). Fast-exits
    // on non-install Bash commands.
    matchedHook('Bash', `bun ${HOOKS_DIR}/post-tool-dependency-readiness.ts`),
  ],
  SessionEnd: [hook(`bun ${HOOKS_DIR}/session-cleanup-quality.ts`)],
};
