/**
 * Unit tests for content templates
 */

import { describe, expect, it } from 'vitest';

import { getEslintConfig, SETTINGS_HOOKS } from './config';

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

  it('should use detect.collectAllDeps for dependency scanning', () => {
    const config = getEslintConfig();

    expect(config).toContain('detect.collectAllDeps(__dirname)');
    expect(config).toContain('detect.detectFramework(deps)');
  });

  it('should include framework detection for config selection', () => {
    const config = getEslintConfig();

    // Config should have baseConfigs mapping
    expect(config).toContain('configs.recommendedTypeScriptNext');
    expect(config).toContain('configs.recommendedTypeScriptReact');
    expect(config).toContain('configs.recommendedTypeScript');
    expect(config).toContain('configs.recommended');
    expect(config).toContain('baseConfigs[framework]');
  });

  it('should include testing and query configs unconditionally (file-scoped)', () => {
    const config = getEslintConfig();

    // Vitest, Playwright, TanStack Query are always included (file-scoped, no false positives)
    expect(config).toContain('configs.vitest');
    expect(config).toContain('configs.playwright');
    expect(config).toContain('configs.tanstackQuery');
  });

  it('should use detection only for Tailwind (plugin needs config to validate classes)', () => {
    const config = getEslintConfig();

    // Tailwind still needs detection because plugin may require tailwind.config.js
    expect(config).toContain('detect.hasTailwind(deps)');
  });

  it('should use detect.getIgnores for standard ignores', () => {
    const config = getEslintConfig();

    expect(config).toContain('detect.getIgnores()');
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

  it('should have PostToolUse quality observer matcher that includes Bash', () => {
    const qualityHook = SETTINGS_HOOKS.PostToolUse.find(h =>
      h.hooks.some(hook => hook.type === 'command' && hook.command.includes('post-tool-quality')),
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

  it('should have PreToolUse hooks for quality enforcement and config guard', () => {
    const preToolHooks = SETTINGS_HOOKS.PreToolUse;
    expect(preToolHooks.length).toBe(2);

    const commands = preToolHooks.flatMap(h =>
      h.hooks.filter(hook => hook.type === 'command').map(hook => hook.command),
    );

    expect(commands.some(c => c.includes('pre-tool-quality'))).toBe(true);
    expect(commands.some(c => c.includes('pre-tool-config-guard'))).toBe(true);
  });

  it('should have all commands reference $CLAUDE_PROJECT_DIR', () => {
    const commands: string[] = [];
    for (const entries of Object.values(SETTINGS_HOOKS)) {
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
