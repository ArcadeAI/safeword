# Task: ESLint 10 Migration

**Type:** Improvement

**Scope:** Upgrade ESLint from v9 to v10, along with `@eslint/js` and `typescript-eslint` to compatible versions. Verify all custom rules, preset configs, and tests work.

**Out of Scope:** New lint rules, config restructuring, upgrading other ESLint plugins beyond what's needed for v10 compat.

**Context:**

- Dependabot PR #55 (`@eslint/js` 9→10) was closed because upgrading `@eslint/js` alone creates a version split
- The root cause: `@typescript-eslint/utils@7.x` references `LegacyESLint` class removed in ESLint 10
- Need `typescript-eslint` version that supports ESLint 10's API
- Safeword ships ESLint config as a preset — users inherit our peer dependency range (`eslint: "^9.0.0"`)
- Bumping to ESLint 10 is a **semver-major** for the safeword package (changes peer dep range)

**Blocked By:**

- `@typescript-eslint/utils` must release a version supporting ESLint 10 (check `typescript-eslint` v9+)

**Done When:**

- [ ] ESLint 10 and `@eslint/js` 10 installed
- [ ] `typescript-eslint` upgraded to ESLint 10-compatible version
- [ ] All preset configs load without errors
- [ ] `bun run lint:eslint` passes
- [ ] All tests pass
- [ ] `peerDependencies.eslint` updated to include v10

**Tests:**

- [ ] Existing ESLint rule tests pass with ESLint 10
- [ ] Preset TypeScript config loads and lints sample files
- [ ] No `LegacyESLint` or `Class extends value undefined` errors
