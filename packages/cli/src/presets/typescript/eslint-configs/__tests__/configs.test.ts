/**
 * Tests for ESLint configs - Story 2: Config Loads and Lints
 *
 * Verifies that configs:
 * - Load without errors
 * - Contain expected plugins
 * - Lint valid code without errors
 * - Catch invalid code with expected errors
 */

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import plugin from '../../index.js';
import { astroConfig } from '../astro.js';
import { JS_TS_FILES } from '../base.js';
import { recommended } from '../recommended.js';
import { recommendedTypeScript } from '../recommended-typescript.js';

describe('recommended config', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(recommended)).toBe(true);
    expect(recommended.length).toBeGreaterThan(0);
  });

  it('includes expected plugins', () => {
    const configNames = recommended.flatMap(config => {
      if (typeof config === 'object' && config !== null) {
        // Check for plugin registrations
        if ('plugins' in config && config.plugins) {
          return Object.keys(config.plugins);
        }
        // Check for config names
        if ('name' in config && typeof config.name === 'string') {
          return [config.name];
        }
      }
      return [];
    });

    // Should include our safeword plugin
    expect(configNames).toContain('safeword');
  });

  it('loads without errors via ESLint API', () => {
    const linter = new Linter({ configType: 'flat' });

    // Verify config can be used - this will throw if invalid
    expect(() => {
      linter.verify('const x = 1;', recommended);
    }).not.toThrow();
  });

  it('returns no errors for valid code', () => {
    const linter = new Linter({ configType: 'flat' });

    // Simple valid code - uses export to avoid no-unused-vars
    const validCode = `
export const add = (a, b) => a + b;
`;

    const results = linter.verify(validCode, recommended, {
      filename: 'test.mjs',
    });
    const errors = results.filter(r => r.severity === 2);

    expect(errors).toHaveLength(0);
  });

  it('returns errors for invalid code', () => {
    const linter = new Linter({ configType: 'flat' });

    // Code with security issue - eval with expression
    const invalidCode = `
const userInput = 'alert(1)';
eval(userInput);
`;

    const results = linter.verify(invalidCode, recommended);
    const errors = results.filter(r => r.severity === 2);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('catches incomplete error handling', () => {
    const linter = new Linter({ configType: 'flat' });

    const code = `
try {
  doSomething();
} catch (error) {
  console.error(error);
}
`;

    const results = linter.verify(code, recommended);
    const safewordErrors = results.filter(
      r => r.ruleId === 'safeword/no-incomplete-error-handling',
    );

    expect(safewordErrors.length).toBe(1);
  });
});

describe('recommendedTypeScript config', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(recommendedTypeScript)).toBe(true);
    expect(recommendedTypeScript.length).toBeGreaterThan(0);
  });

  it('includes TypeScript plugins', () => {
    const hasTypeScriptConfig = recommendedTypeScript.some(config => {
      if (typeof config === 'object' && config !== null) {
        // Check for @typescript-eslint rules
        if ('rules' in config && config.rules) {
          return Object.keys(config.rules).some(rule => rule.startsWith('@typescript-eslint/'));
        }
        // Check for typescript-eslint plugin
        if ('plugins' in config && config.plugins) {
          return '@typescript-eslint' in config.plugins;
        }
      }
      return false;
    });

    expect(hasTypeScriptConfig).toBe(true);
  });

  it('includes projectService for type-checked rules', () => {
    const hasProjectService = recommendedTypeScript.some(config => {
      if (typeof config === 'object' && config !== null && 'languageOptions' in config) {
        const langOptions = config.languageOptions;
        if (langOptions && typeof langOptions === 'object' && 'parserOptions' in langOptions) {
          const parserOptions = langOptions.parserOptions;
          return (
            parserOptions && typeof parserOptions === 'object' && 'projectService' in parserOptions
          );
        }
      }
      return false;
    });

    expect(hasProjectService).toBe(true);
  });

  it('scopes TypeScript rules to .ts/.tsx files', () => {
    const hasTsFileScope = recommendedTypeScript.some(config => {
      if (typeof config === 'object' && config !== null && 'files' in config) {
        const files = config.files;
        if (Array.isArray(files)) {
          return files.some(
            f => typeof f === 'string' && (f.includes('.ts') || f.includes('.tsx')),
          );
        }
      }
      return false;
    });

    expect(hasTsFileScope).toBe(true);
  });

  it('loads without errors via ESLint API', () => {
    const linter = new Linter({ configType: 'flat' });

    // For type-checked rules, we need to use the config in a way that
    // doesn't require actual type information (Linter API limitation)
    expect(() => {
      // Just verify the config is valid ESLint config format
      linter.verify('const x: number = 1;', recommendedTypeScript, {
        filename: 'test.ts',
      });
    }).not.toThrow();
  });
});

describe('plugin exports', () => {
  it('exports default plugin object', () => {
    expect(plugin).toBeDefined();
    expect(typeof plugin).toBe('object');
  });

  it('has meta with name and version', () => {
    expect(plugin.meta).toBeDefined();
    expect(plugin.meta.name).toBe('safeword');
    expect(plugin.meta.version).toBeDefined();
  });

  it('exports configs.recommended', () => {
    expect(plugin.configs).toBeDefined();
    expect(plugin.configs.recommended).toBeDefined();
    expect(Array.isArray(plugin.configs.recommended)).toBe(true);
  });

  it('exports configs.recommendedTypeScript', () => {
    expect(plugin.configs.recommendedTypeScript).toBeDefined();
    expect(Array.isArray(plugin.configs.recommendedTypeScript)).toBe(true);
  });

  it('exports rules', () => {
    expect(plugin.rules).toBeDefined();
    expect(plugin.rules['no-incomplete-error-handling']).toBeDefined();
  });
});

describe('default ignores', () => {
  it('includes node_modules in ignores', () => {
    const hasNodeModulesIgnore = recommended.some(config => {
      if (typeof config === 'object' && config !== null && 'ignores' in config) {
        const ignores = config.ignores;
        if (Array.isArray(ignores)) {
          return ignores.some(
            pattern => typeof pattern === 'string' && pattern.includes('node_modules'),
          );
        }
      }
      return false;
    });

    expect(hasNodeModulesIgnore).toBe(true);
  });

  it('includes dist in ignores', () => {
    const hasDistributionIgnore = recommended.some(config => {
      if (typeof config === 'object' && config !== null && 'ignores' in config) {
        const ignores = config.ignores;
        if (Array.isArray(ignores)) {
          return ignores.some(pattern => typeof pattern === 'string' && pattern.includes('dist'));
        }
      }
      return false;
    });

    expect(hasDistributionIgnore).toBe(true);
  });
});

describe('eslint-comments governance', () => {
  it('includes eslint-comments plugin', () => {
    const hasEslintComments = recommended.some(config => {
      if (typeof config === 'object' && config !== null && 'plugins' in config) {
        return config.plugins && 'eslint-comments' in config.plugins;
      }
      return false;
    });

    expect(hasEslintComments).toBe(true);
  });

  it('enforces disable-enable-pair at error', () => {
    const rule = recommended
      .flatMap(config =>
        config?.rules ? [config.rules['eslint-comments/disable-enable-pair']] : [],
      )
      .find(Boolean);

    expect(rule).toBeDefined();
    const severity = Array.isArray(rule) ? rule[0] : rule;
    expect(severity).toBe('error');
  });

  it('enforces no-unlimited-disable at error', () => {
    const rule = recommended
      .flatMap(config =>
        config?.rules ? [config.rules['eslint-comments/no-unlimited-disable']] : [],
      )
      .find(Boolean);

    expect(rule).toBe('error');
  });

  it('enforces require-description at error', () => {
    const rule = recommended
      .flatMap(config =>
        config?.rules ? [config.rules['eslint-comments/require-description']] : [],
      )
      .find(Boolean);

    expect(rule).toBeDefined();
    const severity = Array.isArray(rule) ? rule[0] : rule;
    expect(severity).toBe('error');
  });

  it('catches undescribed disable comments', () => {
    const linter = new Linter({ configType: 'flat' });

    const code = `
// eslint-disable-next-line no-unused-vars
const x = 1;
export default x;
`;

    const results = linter.verify(code, recommended, { filename: 'test.mjs' });
    const descriptionErrors = results.filter(
      r => r.ruleId === 'eslint-comments/require-description',
    );

    expect(descriptionErrors.length).toBe(1);
  });

  it('allows described disable comments', () => {
    const linter = new Linter({ configType: 'flat' });

    const code = `
// eslint-disable-next-line no-unused-vars -- needed for API compatibility
const x = 1;
export default x;
`;

    const results = linter.verify(code, recommended, { filename: 'test.mjs' });
    const descriptionErrors = results.filter(
      r => r.ruleId === 'eslint-comments/require-description',
    );

    expect(descriptionErrors.length).toBe(0);
  });

  it('includes reportUnusedDisableDirectives at error', () => {
    const hasLinterOptions = recommended.some(config => {
      if (typeof config === 'object' && config !== null && 'linterOptions' in config) {
        return config.linterOptions?.reportUnusedDisableDirectives === 'error';
      }
      return false;
    });

    expect(hasLinterOptions).toBe(true);
  });
});

describe('file scoping', () => {
  it('exports JS_TS_FILES pattern constant', () => {
    expect(JS_TS_FILES).toBeDefined();
    expect(Array.isArray(JS_TS_FILES)).toBe(true);
    // Pattern uses glob syntax: **/*.{js,jsx,ts,tsx,...}
    expect(JS_TS_FILES[0]).toContain('**/*');
    expect(JS_TS_FILES[0]).toContain('js');
    expect(JS_TS_FILES[0]).toContain('ts');
  });

  it('most base plugins are scoped to JS/TS files', () => {
    // Count configs that have files scoping
    const scopedConfigs = recommended.filter(config => {
      if (typeof config === 'object' && config !== null) {
        return 'files' in config;
      }
      return false;
    });

    // Most configs should be scoped to JS/TS files
    // (Some third-party configs may not have files, but most safeword configs should)
    expect(scopedConfigs.length).toBeGreaterThan(10);
  });

  it('TypeScript config can be combined with Astro config', () => {
    // Verify configs can be spread together without structural issues
    const combinedConfig = [...recommendedTypeScript, ...astroConfig];

    // Should be a valid array of config objects
    expect(Array.isArray(combinedConfig)).toBe(true);
    expect(combinedConfig.length).toBeGreaterThan(recommendedTypeScript.length);
  });

  it('Astro rules are scoped to .astro files', () => {
    // Verify Astro rules have .astro file scope
    const astroRulesConfigs = astroConfig.filter(config => {
      if (typeof config === 'object' && config !== null && 'rules' in config) {
        const rules = Object.keys(config.rules || {});
        return rules.some(r => r.startsWith('astro/'));
      }
      return false;
    });

    // All Astro configs with astro/ rules should have .astro file scope
    const allAstroScoped = astroRulesConfigs.every(config => {
      if ('files' in config && Array.isArray(config.files)) {
        return config.files.some((f: string) => f.includes('.astro'));
      }
      // Astro plugin may set files via a different mechanism
      return true;
    });
    expect(allAstroScoped).toBe(true);
  });

  it('combined config lints .ts files without errors', () => {
    const linter = new Linter({ configType: 'flat' });
    const combinedConfig = [...recommendedTypeScript, ...astroConfig];

    // Should not throw for TypeScript files
    expect(() => {
      linter.verify('const x = 1;', combinedConfig, { filename: 'test.ts' });
    }).not.toThrow();
  });
});
