/**
 * Unit tests for content templates
 */

import { describe, expect, it } from 'vitest';

import { getEslintConfig, getSafewordEslintConfig, SETTINGS_HOOKS } from './config.js';

// Element type of any SETTINGS_HOOKS bucket (PostToolUse, PreToolUse, etc.)
// Each is a list of { matcher?, hooks: { type, command }[] } entries.
type HookEntry = (typeof SETTINGS_HOOKS)[keyof typeof SETTINGS_HOOKS][number];
type HookCommand = HookEntry['hooks'][number];

describe('getEslintConfig', () => {
  it('should use import.meta.dirname for config-relative path resolution (not CWD)', () => {
    // This test documents a critical fix: the ESLint config must resolve package.json
    // relative to the config file location, NOT relative to process.cwd().
    // When lint-staged runs from a subdirectory in a monorepo, CWD-relative resolution
    // would read the wrong package.json and fail to find framework ESLint plugins.
    const config = getEslintConfig();

    // Must use import.meta.dirname for config-relative resolution
    expect(config).toContain('import.meta.dirname');
    // Should NOT use the verbose fileURLToPath pattern (triggers unicorn/prefer-import-meta-properties)
    expect(config).not.toContain('fileURLToPath');
  });

  it('should import safeword/eslint and destructure detect/configs', () => {
    const config = getEslintConfig();

    expect(config).toContain('import safeword from "safeword/eslint"');
    expect(config).toContain('const { detect, configs } = safeword');
  });

  // Contract pins over the emitted source, deduped into one table (audit A7192X):
  // each entry is part of the generated config's public wiring — the safeword/eslint
  // detection API it calls and the base-config selection it performs. Behavioral
  // coverage (the config actually linting) lives in tests/integration/golden-path.test.ts;
  // these only guard the emitted contract, so a rename in the safeword/eslint API
  // shows up here before it ships broken configs to users.
  it.each([
    ['dependency scanning', 'detect.collectAllDeps(__dirname)'],
    ['framework detection', 'detect.detectFramework(deps)'],
    ['framework base-config selection', 'baseConfigs[framework]'],
    ['Next.js base config', 'configs.recommendedTypeScriptNext'],
    ['React base config', 'configs.recommendedTypeScriptReact'],
    ['TypeScript base config', 'configs.recommendedTypeScript'],
    ['plain-JS base config', 'configs.recommended'],
    ['conditional Vitest plugin', 'detect.hasVitest(deps)'],
    ['conditional bun:test plugin', 'detect.hasBunTest(deps, __dirname)'],
    ['conditional Playwright plugin', 'detect.hasPlaywright(deps)'],
    ['conditional Storybook plugin', 'detect.hasStorybook(deps)'],
    ['conditional TanStack Query plugin', 'detect.hasTanstackQuery(deps)'],
    [
      'Tailwind detection (plugin needs tailwind.config to validate classes)',
      'detect.hasTailwind(deps)',
    ],
    ['standard ignores', 'detect.getIgnores()'],
  ])('generated config wires %s', (_purpose, contractCall) => {
    // Boundary-anchored so short rows can't pass via longer siblings
    // (`configs.recommended` must not be satisfied by `configs.recommendedTypeScriptNext`).
    const escaped = contractCall.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    // eslint-disable-next-line security/detect-non-literal-regexp -- escaped table literal
    expect(getEslintConfig()).toMatch(new RegExp(`${escaped}(?![A-Za-z])`));
  });

  it('should include eslint-config-prettier when no existing formatter', () => {
    const config = getEslintConfig(false);

    expect(config).toContain('eslintConfigPrettier');
  });

  it('should NOT include eslint-config-prettier when existing formatter present', () => {
    const config = getEslintConfig(true);

    expect(config).not.toContain('eslintConfigPrettier');
  });
});

describe('getEslintConfig monorepo support', () => {
  it('should use detect.findNextConfigPaths for monorepo detection', () => {
    const config = getEslintConfig();

    expect(config).toContain('detect.findNextConfigPaths');
  });

  it('should include configs.nextOnlyRules for file-scoped Next.js rules', () => {
    const config = getEslintConfig();

    expect(config).toContain('configs.nextOnlyRules');
  });

  it('should scope Next.js rules using files: property in monorepo', () => {
    const config = getEslintConfig();

    // Should have logic to apply nextOnlyRules with files scoping
    expect(config).toContain('files:');
    expect(config).toContain('nextPaths');
  });
});

describe('getSafewordEslintConfig', () => {
  it('imports safeword when generated config references safeword.prettierConfig', () => {
    const config = getSafewordEslintConfig('eslint.config.mjs', false);

    expect(config).toContain('import safeword from "safeword/eslint"');
    expect(config).toContain('const eslintConfigPrettier = safeword.prettierConfig;');
  });

  it('does not reference safeword.prettierConfig in formatter-agnostic generated config', () => {
    const config = getSafewordEslintConfig('eslint.config.mjs', true);

    expect(config).not.toContain('safeword.prettierConfig');
    expect(config).not.toContain('import safeword from "safeword/eslint"');
  });

  it('loads TypeScript project configs through jiti', () => {
    const config = getSafewordEslintConfig('eslint.config.ts', false);

    expect(config).toContain('const { createJiti } = await import("jiti");');
    expect(config).toContain('const jiti = createJiti(import.meta.url);');
    expect(config).toContain('jiti.import(projectConfigPath.href, { default: true })');
    expect(config).toContain('isTypeScriptProjectConfig(projectConfigPath)');
  });
});

describe('SETTINGS_HOOKS', () => {
  it('should define all required hook types', () => {
    expect(SETTINGS_HOOKS).toHaveProperty('SessionStart');
    expect(SETTINGS_HOOKS).toHaveProperty('UserPromptSubmit');
    expect(SETTINGS_HOOKS).toHaveProperty('Stop');
    expect(SETTINGS_HOOKS).toHaveProperty('PreToolUse');
    expect(SETTINGS_HOOKS).toHaveProperty('PostToolUse');
  });

  it('should have valid PostToolUse lint matcher that targets edit tools only', () => {
    const hook = SETTINGS_HOOKS.PostToolUse.at(0);
    if (!hook) {
      throw new Error('PostToolUse hook not found');
    }
    const matcher = hook.matcher;

    // Must be valid regex
    // eslint-disable-next-line security/detect-non-literal-regexp -- Testing user-defined matcher pattern
    expect(() => new RegExp(matcher)).not.toThrow();

    // Claude Code uses unanchored regex matching
    // eslint-disable-next-line security/detect-non-literal-regexp -- Testing user-defined matcher pattern
    const regex = new RegExp(matcher);

    // Should match file-modifying tools
    expect(regex.test('Write')).toBe(true);
    expect(regex.test('Edit')).toBe(true);
    expect(regex.test('MultiEdit')).toBe(true);
    expect(regex.test('NotebookEdit')).toBe(true);

    // Should NOT match read-only tools
    expect(regex.test('Read')).toBe(false);
    expect(regex.test('Bash')).toBe(false);
    expect(regex.test('Grep')).toBe(false);
  });

  it('should run the auto-upgrade hook as a non-blocking asyncRewake hook', () => {
    // Pins ticket XQ9CXA: the upgrade runs in the background (never blocks
    // session start) yet can still surface "upgraded" / "major available" /
    // "blocked" messages via exit-2 rewake. Reverting it to a blocking sync
    // hook (dropping asyncRewake) fails this test.
    const command = SETTINGS_HOOKS.SessionStart.flatMap((entry: HookEntry) => entry.hooks).find(
      (hook: HookCommand) =>
        hook.type === 'command' && hook.command.includes('session-auto-upgrade'),
    ) as { asyncRewake?: boolean } | undefined;
    if (!command) {
      throw new Error('session-auto-upgrade hook not found');
    }
    expect(command.asyncRewake).toBe(true);
  });

  it('retro-recall.TB1.AC1: registers the retro Stop hook async (non-blocking, not asyncRewake)', () => {
    // ZFGWS1: async:true backgrounds the whole hook tree (returns immediately,
    // 600s) so repeated delta fires never block Stop. NOT asyncRewake, which
    // surfaces stderr into the chat on exit 2 and would break invisibility.
    // 'stop-retro.ts' exactly — 'stop-retro' alone would also match the SYNC
    // filing-gate hook (stop-retro-filing.ts, GH628F).
    const command = SETTINGS_HOOKS.Stop.flatMap((entry: HookEntry) => entry.hooks).find(
      (hook: HookCommand) => hook.type === 'command' && hook.command.includes('stop-retro.ts'),
    ) as { async?: boolean; asyncRewake?: boolean } | undefined;
    if (!command) {
      throw new Error('stop-retro hook not found');
    }
    expect(command.async).toBe(true);
    expect(command.asyncRewake).toBeUndefined();
  });

  it('GH628F: registers the retro filing gate Stop hook sync (blocking continuation)', () => {
    // The filing dispatch must be able to block the stop (decision:"block"), so
    // it cannot be async/backgrounded like the extraction hook.
    const command = SETTINGS_HOOKS.Stop.flatMap((entry: HookEntry) => entry.hooks).find(
      (hook: HookCommand) => hook.type === 'command' && hook.command.includes('stop-retro-filing'),
    ) as { async?: boolean } | undefined;
    if (!command) {
      throw new Error('stop-retro-filing hook not found');
    }
    expect(command.async).toBeUndefined();
  });

  it('should have PostToolUse quality observer matcher that includes Bash', () => {
    const qualityHook = SETTINGS_HOOKS.PostToolUse.find((h: HookEntry) =>
      h.hooks.some(
        (hook: HookCommand) =>
          hook.type === 'command' && hook.command.includes('post-tool-quality'),
      ),
    );
    if (!qualityHook) {
      throw new Error('PostToolUse quality hook not found');
    }

    // eslint-disable-next-line security/detect-non-literal-regexp -- Testing user-defined matcher pattern
    const regex = new RegExp(qualityHook.matcher);

    // Should match edit tools AND Bash (for commit detection)
    expect(regex.test('Write')).toBe(true);
    expect(regex.test('Edit')).toBe(true);
    expect(regex.test('Bash')).toBe(true);

    // Should NOT match read-only tools
    expect(regex.test('Read')).toBe(false);
    expect(regex.test('Grep')).toBe(false);
  });

  it('should have PreToolUse hooks for dependency readiness, quality enforcement, config guard, git-bare-race fix, architecture staging, and stale-branch checkout', () => {
    const preToolHooks = SETTINGS_HOOKS.PreToolUse;
    expect(preToolHooks).toHaveLength(8);

    const commands = preToolHooks.flatMap((h: HookEntry) =>
      h.hooks
        .filter((hook: HookCommand) => hook.type === 'command')
        .map((hook: HookCommand) => hook.command),
    );

    expect(commands.some((c: string) => c.includes('pre-tool-dependency-readiness'))).toBe(true);
    expect(commands.some((c: string) => c.includes('pre-tool-quality'))).toBe(true);
    expect(commands.some((c: string) => c.includes('pre-tool-config-guard'))).toBe(true);
    expect(commands.some((c: string) => c.includes('pre-tool-git-bare-fix'))).toBe(true);
    expect(commands.some((c: string) => c.includes('pre-tool-architecture-stage'))).toBe(true);
    expect(commands.some((c: string) => c.includes('pre-tool-stale-main'))).toBe(true);
  });

  it('pre-tool-quality is wired for Bash so its shell gates fire on Claude (K4STDR, #773)', () => {
    // The hook's Bash branch (ledger write gate W42G34, REFACTOR commit gate
    // J7VBGJ, process-kill guard K4STDR) only fires if a Bash matcher routes
    // shell commands to it — the EDIT_TOOLS matcher alone leaves it dead.
    const qualityMatchers = SETTINGS_HOOKS.PreToolUse.filter((h: HookEntry) =>
      h.hooks.some(
        (hook: HookCommand) => hook.type === 'command' && hook.command.includes('pre-tool-quality'),
      ),
    ).map((h: HookEntry) => ('matcher' in h ? h.matcher : undefined));
    expect(qualityMatchers).toContain('Bash');
    expect(qualityMatchers).toContain('Edit|Write|MultiEdit|NotebookEdit');
  });

  it('post-tool-work-log is wired for edit tools so phase stamps fire on Claude (E32M4P, #772)', () => {
    const workLogMatchers = SETTINGS_HOOKS.PostToolUse.filter((h: HookEntry) =>
      h.hooks.some(
        (hook: HookCommand) =>
          hook.type === 'command' && hook.command.includes('post-tool-work-log'),
      ),
    ).map((h: HookEntry) => ('matcher' in h ? h.matcher : undefined));
    expect(workLogMatchers).toContain('Edit|Write|MultiEdit|NotebookEdit');
  });

  it('stale-main hook is wired to git checkout and git switch with if-filters (#366)', () => {
    const staleHooks = SETTINGS_HOOKS.PreToolUse.filter((h: HookEntry) =>
      h.hooks.some(
        (hook: HookCommand) =>
          hook.type === 'command' && hook.command.includes('pre-tool-stale-main'),
      ),
    );
    const ifFilters = staleHooks
      .flatMap((h: HookEntry) => h.hooks)
      .filter((hook: HookCommand) => hook.type === 'command')
      .map((hook: HookCommand) => (hook as { if?: string }).if);
    expect(ifFilters).toEqual(expect.arrayContaining(['Bash(git checkout*)', 'Bash(git switch*)']));
    expect(staleHooks.every((h: HookEntry) => (h as { matcher?: string }).matcher === 'Bash')).toBe(
      true,
    );
  });

  it('architecture-stage hook uses Bash matcher with a git-commit if-filter to scope the spawn', () => {
    const stageHook = SETTINGS_HOOKS.PreToolUse.find((h: HookEntry) =>
      h.hooks.some(
        (hook: HookCommand) =>
          hook.type === 'command' && hook.command.includes('pre-tool-architecture-stage'),
      ),
    );
    expect(stageHook).toBeDefined();
    expect(stageHook?.matcher).toBe('Bash');
    const command = stageHook?.hooks.find((h: HookCommand) => h.type === 'command') as
      { if?: string; command: string } | undefined;
    expect(command?.if).toBe('Bash(git commit*)');
  });

  it('git-bare-race hook uses Bash matcher with if-filter to avoid spawning on non-git Bash calls', () => {
    const bareRaceHook = SETTINGS_HOOKS.PreToolUse.find((h: HookEntry) =>
      h.hooks.some(
        (hook: HookCommand) =>
          hook.type === 'command' && hook.command.includes('pre-tool-git-bare-fix'),
      ),
    );
    expect(bareRaceHook).toBeDefined();
    expect(bareRaceHook?.matcher).toBe('Bash');
    const command = bareRaceHook?.hooks.find((h: HookCommand) => h.type === 'command') as
      { if?: string; command: string } | undefined;
    expect(command?.if).toBe('Bash(git *)');
  });

  it('should have all commands reference $CLAUDE_PROJECT_DIR', () => {
    const commands: string[] = [];
    for (const entries of Object.values(SETTINGS_HOOKS) as HookEntry[][]) {
      for (const entry of entries) {
        for (const hook of entry.hooks) {
          if (hook.type === 'command') {
            commands.push(hook.command);
          }
        }
      }
    }

    expect(commands.length).toBeGreaterThan(0);
    for (const command of commands) {
      expect(command, `Command missing $CLAUDE_PROJECT_DIR: ${command}`).toContain(
        '$CLAUDE_PROJECT_DIR',
      );
    }
  });
});
