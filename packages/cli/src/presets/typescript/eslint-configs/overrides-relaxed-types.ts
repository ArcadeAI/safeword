/**
 * Relaxed Type-Checking preset
 *
 * Disables strict TypeScript rules that produce false positives when
 * code handles data without compile-time types: JSON parsing, YAML
 * loading, API responses, dynamic config files, and user input.
 *
 * Usage:
 *   import { defineConfig } from 'eslint/config';
 *   import safeword from 'safeword/eslint';
 *   export default defineConfig([
 *     ...safeword.configs.recommendedTypeScript,
 *     safeword.configs.relaxedTypes,
 *   ]);
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages
export const relaxedTypesConfig: any = {
  name: 'safeword/relaxed-types',
  rules: {
    // External data (JSON, YAML, API responses) has no compile-time types
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    // Boolean checks on untyped values are valid guards, not unnecessary
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/no-unnecessary-condition': 'off',
    '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
    // Fallback operators on untyped values are intentional
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    // Template literals with untyped values are common in logging/output
    '@typescript-eslint/restrict-template-expressions': 'off',
  },
};
