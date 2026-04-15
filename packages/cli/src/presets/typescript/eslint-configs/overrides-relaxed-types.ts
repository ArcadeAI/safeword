/**
 * Relaxed Type-Checking Overrides
 *
 * Disables strict TypeScript rules that produce false positives when
 * code handles data without compile-time types: JSON parsing, YAML
 * loading, API responses, dynamic config files, and user input.
 *
 * Usage:
 *   import safeword from 'safeword/eslint';
 *   export default [
 *     ...safeword.configs.recommendedTypeScript,
 *     safeword.overrides.relaxedTypes,
 *   ];
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages
export const relaxedTypesOverrides: any = {
  name: 'safeword/overrides-relaxed-types',
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
