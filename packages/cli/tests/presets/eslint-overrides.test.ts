import { describe, expect, it } from 'vitest';

import { cliConfig } from '../../src/presets/typescript/eslint-configs/overrides-cli.js';
import { relaxedTypesConfig } from '../../src/presets/typescript/eslint-configs/overrides-relaxed-types.js';
import { eslintPlugin } from '../../src/presets/typescript/index.js';

describe('ESLint preset configs (cli, relaxedTypes)', () => {
  describe('configs.cli', () => {
    it('exports a named config object with rules', () => {
      expect(cliConfig).toEqual(
        expect.objectContaining({
          name: 'safeword/cli',
          rules: expect.any(Object),
        }),
      );
    });

    it('turns off security false positives for CLI tools', () => {
      const rules = cliConfig.rules;
      expect(rules['security/detect-non-literal-fs-filename']).toBe('off');
      expect(rules['security/detect-object-injection']).toBe('off');
      expect(rules['sonarjs/no-os-command-from-path']).toBe('off');
      expect(rules['sonarjs/os-command']).toBe('off');
      expect(rules['sonarjs/different-types-comparison']).toBe('off');
    });

    it('only contains off rules (never adds new rules)', () => {
      for (const value of Object.values(cliConfig.rules)) {
        expect(value).toBe('off');
      }
    });
  });

  describe('configs.relaxedTypes', () => {
    it('exports a named config object with rules', () => {
      expect(relaxedTypesConfig).toEqual(
        expect.objectContaining({
          name: 'safeword/relaxed-types',
          rules: expect.any(Object),
        }),
      );
    });

    it('turns off strict TypeScript rules for untyped data', () => {
      const rules = relaxedTypesConfig.rules;
      expect(rules['@typescript-eslint/no-unsafe-argument']).toBe('off');
      expect(rules['@typescript-eslint/no-unsafe-assignment']).toBe('off');
      expect(rules['@typescript-eslint/no-unsafe-call']).toBe('off');
      expect(rules['@typescript-eslint/no-unsafe-member-access']).toBe('off');
      expect(rules['@typescript-eslint/no-unsafe-return']).toBe('off');
      expect(rules['@typescript-eslint/strict-boolean-expressions']).toBe('off');
      expect(rules['@typescript-eslint/restrict-template-expressions']).toBe('off');
    });

    it('only contains off rules (never adds new rules)', () => {
      for (const value of Object.values(relaxedTypesConfig.rules)) {
        expect(value).toBe('off');
      }
    });
  });

  describe('plugin export', () => {
    it('exposes cli and relaxedTypes under configs', () => {
      expect(eslintPlugin.configs.cli).toBe(cliConfig);
      expect(eslintPlugin.configs.relaxedTypes).toBe(relaxedTypesConfig);
    });

    it('configs.cli and configs.relaxedTypes are plain objects (not arrays)', () => {
      expect(Array.isArray(eslintPlugin.configs.cli)).toBe(false);
      expect(Array.isArray(eslintPlugin.configs.relaxedTypes)).toBe(false);
    });

    it('legacy overrides namespace has been removed', () => {
      expect((eslintPlugin as unknown as { overrides?: unknown }).overrides).toBeUndefined();
    });

    it('declares meta.namespace for defineConfig string-extends resolution', () => {
      expect(eslintPlugin.meta.namespace).toBe('safeword');
    });
  });
});
