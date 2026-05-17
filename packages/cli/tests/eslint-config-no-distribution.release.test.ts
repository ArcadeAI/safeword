/**
 * Release gate: ESLint configs must not import from `dist/`.
 *
 * Why this matters: a fresh git worktree starts with no `node_modules` and
 * no `dist/`. After `bun install`, `git commit` should "just work" — the
 * pre-commit hook should not require a prior `bun run build` step.
 *
 * Historically `eslint.config.mjs` imported safeword presets from
 * `packages/cli/dist/presets/typescript/index.js`. This made linting
 * depend on the CLI's own build output, breaking fresh worktrees and
 * coupling lint to a build that exists for `.d.ts` consumers, not for
 * the linter (see ticket #147, ticket #140).
 *
 * The fix: import directly from `packages/cli/src/presets/typescript/index.ts`.
 * Loaded via jiti (declared as a dev dep) when running on Node, or
 * natively when running on Bun.
 *
 * This test guards against regression — anyone who adds `dist/` back to an
 * ESLint config file at the root or in `packages/cli/` will fail this gate.
 *
 * Excluded from `bun run test` (release-gate only).
 * Run with: bun run test:release
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');

const ESLINT_CONFIG_FILES = ['eslint.config.ts', 'packages/cli/eslint.config.ts'] as const;

describe('eslint config imports', () => {
  for (const relativePath of ESLINT_CONFIG_FILES) {
    it(`${relativePath} should not import from dist/`, () => {
      const absolutePath = nodePath.join(REPO_ROOT, relativePath);
      const source = readFileSync(absolutePath, 'utf8');

      // Match any import/require referencing a dist/ path.
      // We deliberately allow the substring "dist" in comments/strings
      // unrelated to module resolution by only flagging import statements.
      const importLines = source
        .split('\n')
        .filter(line => /^\s*(?:import|export)\s.+\sfrom\s/.test(line));

      const distributionImports = importLines.filter(line => line.includes('/dist/'));

      expect(
        distributionImports,
        `${relativePath} imports from dist/, which breaks fresh worktrees. ` +
          `Import from packages/cli/src/presets/typescript/index.ts instead. ` +
          `See ticket #147.`,
      ).toEqual([]);
    });
  }
});
