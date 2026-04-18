/**
 * CLI Tool preset
 *
 * Disables security rules that produce false positives for CLI tools,
 * build tools, and scripts that work with dynamic file paths and
 * shell commands by design.
 *
 * Usage:
 *   import { defineConfig } from 'eslint/config';
 *   import safeword from 'safeword/eslint';
 *   export default defineConfig([
 *     ...safeword.configs.recommendedTypeScript,
 *     safeword.configs.cli,
 *   ]);
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages
export const cliConfig: any = {
  name: 'safeword/cli',
  rules: {
    // CLI tools read/write user-provided paths — not an injection vector
    'security/detect-non-literal-fs-filename': 'off',
    // CLI tools index objects with user-provided keys (parsed JSON/YAML)
    'security/detect-object-injection': 'off',
    // CLI tools execute commands from PATH — this is expected, not an attack
    'sonarjs/no-os-command-from-path': 'off',
    'sonarjs/os-command': 'off',
    // CLI tools compare mixed types from parsed user input
    'sonarjs/different-types-comparison': 'off',
  },
};
