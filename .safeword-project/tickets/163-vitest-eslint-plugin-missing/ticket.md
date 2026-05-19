---
id: 163
type: patch
phase: intake
status: in_progress
created: 2026-05-19T20:59:00Z
last_modified: 2026-05-19T20:59:00Z
scope: |
  Fix 3 test files that fail with `Cannot find package '@vitest/eslint-plugin'`:
  - packages/cli/src/presets/typescript/eslint-configs/__tests__/plugins.test.ts
  - packages/cli/src/presets/typescript/eslint-configs/__tests__/configs.test.ts
  - packages/cli/tests/presets/eslint-overrides.test.ts

  Diagnosis so far: `@vitest/eslint-plugin@^1.6.17` IS declared in
  `packages/cli/package.json` devDependencies and IS imported by
  `packages/cli/src/presets/typescript/eslint-configs/vitest.ts:10`, but is
  NOT present in `node_modules/@vitest/`. Only `@vitest/coverage-v8` is
  installed under that scope.

  Likely cause: peer-dep resolution conflict between
  `@vitest/eslint-plugin@^1.6.17` (which may peer-require vitest 3.x) and
  the project's `vitest@^4.1.5`. Bun silently drops the package rather
  than install an incompatible peer version.

  Resolution paths (decide during fix):
  (a) Upgrade @vitest/eslint-plugin to a version compatible with vitest 4.x
  (b) If no compatible version exists, vendor the small subset of rules used
  (c) Remove the dep + rules if they're not load-bearing
out_of_scope: |
  - Migrating away from vitest to another test runner
  - Rewriting eslint-configs/vitest.ts substantially
  - Adding new ESLint rules
done_when: |
  - `node_modules/@vitest/eslint-plugin/` exists after `bun install`
  - Three failing test files pass: plugins.test.ts, configs.test.ts, eslint-overrides.test.ts
  - No new failures introduced in adjacent eslint-config tests
  - lint + build remain clean
---

# Fix `@vitest/eslint-plugin` missing-package failures in eslint-config tests

**Goal:** Three test files in the eslint-configs area fail because `@vitest/eslint-plugin` isn't installed despite being declared in package.json. Get them green.

**Why:** Pre-existing on `origin/main` — not introduced by ticket 152's session work, but surfaces now in full test runs and erodes confidence. Likely a peer-dep mismatch between the plugin's `vitest@3.x` requirement and our project's `vitest@^4.1.5`. Three test files affected; resolution should take an hour at most.

## Work Log

- 2026-05-19T20:59:00Z Started: ticket created from test failures surfaced during ticket-152 session's post-rebase verification.
