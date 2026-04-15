import { describe, expect, it } from 'vitest';

import { cliOverrides } from '../../src/presets/typescript/eslint-configs/overrides-cli.js';
import { relaxedTypesOverrides } from '../../src/presets/typescript/eslint-configs/overrides-relaxed-types.js';
import { eslintPlugin } from '../../src/presets/typescript/index.js';

describe('ESLint override presets', () => {
  describe('overrides.cli', () => {
    it('exports a named config object with rules', () => {
      expect(cliOverrides).toEqual(
        expect.objectContaining({
          name: 'safeword/overrides-cli',
          rules: expect.any(Object),
        }),
      );
    });

    it('turns off security false positives for CLI tools', () => {
      const rules = cliOverrides.rules;
      expect(rules['security/detect-non-literal-fs-filename']).toBe('off');
      expect(rules['security/detect-object-injection']).toBe('off');
      expect(rules['sonarjs/no-os-command-from-path']).toBe('off');
      expect(rules['sonarjs/os-command']).toBe('off');
      expect(rules['sonarjs/different-types-comparison']).toBe('off');
    });

    it('only contains off rules (never adds new rules)', () => {
      for (const value of Object.values(cliOverrides.rules)) {
        expect(value).toBe('off');
      }
    });
  });

  describe('overrides.relaxedTypes', () => {
    it('exports a named config object with rules', () => {
      expect(relaxedTypesOverrides).toEqual(
        expect.objectContaining({
          name: 'safeword/overrides-relaxed-types',
          rules: expect.any(Object),
        }),
      );
    });

    it('turns off strict TypeScript rules for untyped data', () => {
      const rules = relaxedTypesOverrides.rules;
      expect(rules['@typescript-eslint/no-unsafe-argument']).toBe('off');
      expect(rules['@typescript-eslint/no-unsafe-assignment']).toBe('off');
      expect(rules['@typescript-eslint/no-unsafe-call']).toBe('off');
      expect(rules['@typescript-eslint/no-unsafe-member-access']).toBe('off');
      expect(rules['@typescript-eslint/no-unsafe-return']).toBe('off');
      expect(rules['@typescript-eslint/strict-boolean-expressions']).toBe('off');
      expect(rules['@typescript-eslint/restrict-template-expressions']).toBe('off');
    });

    it('only contains off rules (never adds new rules)', () => {
      for (const value of Object.values(relaxedTypesOverrides.rules)) {
        expect(value).toBe('off');
      }
    });
  });

  describe('plugin export', () => {
    it('exposes overrides on the main plugin object', () => {
      expect(eslintPlugin.overrides).toBeDefined();
      expect(eslintPlugin.overrides.cli).toBe(cliOverrides);
      expect(eslintPlugin.overrides.relaxedTypes).toBe(relaxedTypesOverrides);
    });

    it('overrides are plain objects (not arrays)', () => {
      expect(Array.isArray(eslintPlugin.overrides.cli)).toBe(false);
      expect(Array.isArray(eslintPlugin.overrides.relaxedTypes)).toBe(false);
    });
  });
});
