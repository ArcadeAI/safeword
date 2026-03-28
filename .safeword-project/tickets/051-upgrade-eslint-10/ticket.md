---
id: 051
slug: upgrade-eslint-10
type: task
status: backlog
phase: research
---

# Upgrade ESLint 9 → 10

**Goal:** Upgrade `eslint` from 9.39.4 to 10.x.

## Why

ESLint 10 is a major version — deferred from audit 2026-03-22 due to potential breaking changes in flat config, plugin APIs, or rule behaviour.

## Research (2026-03-27)

### ESLint 10 Release Status

- v10.0.0 GA: 2026-02-06. Current latest: 10.1.0.
- ESLint 9.x on `maintenance` dist-tag (9.39.4).

### Breaking Changes Summary

#### Won't Break (Low Risk)

| Area                     | Why Safe                                                      |
| ------------------------ | ------------------------------------------------------------- |
| Flat config              | Already `.mjs` flat config everywhere — no legacy `.eslintrc` |
| `eslint-config-prettier` | Pure rule-disable config, no API usage                        |
| Lint-staged / Husky      | Shell invocations (`eslint --fix`) — CLI stable               |
| Prettier integration     | Separate tool, unaffected                                     |

#### Likely to Break (High Risk)

| Area                             | Detail                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| New recommended rules            | 3 new rules: `no-unassigned-vars`, `no-useless-assignment`, `preserve-caught-error` — will produce new lint errors                  |
| Config lookup change             | ESLint 10 searches from each file's directory upward (not CWD). Monorepo + hooks config may behave differently                      |
| `eslint-plugin-import-x ^4.16.2` | Historically fragile across major bumps, uses internal ESLint APIs                                                                  |
| 25 plugins need compat           | Any plugin using removed `context.getSourceCode()`, `context.getCwd()`, `context.getFilename()`, `context.parserOptions` will throw |

#### Needs Verification (Medium Risk)

| Area                              | Detail                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `typescript-eslint ^8.56.0`       | Likely has ESLint 10 support — confirm minimum version                           |
| `eslint-plugin-unicorn ^62.0.0`   | Well-maintained but uses deep internals                                          |
| `eslint-plugin-react ^7.37.5`     | JSX reference tracking changed in ESLint 10                                      |
| `eslint-plugin-sonarjs ^3.0.5`    | Check removed `context.*` methods                                                |
| `eslint-plugin-astro ^1.5.0`      | Niche, slower update cadence                                                     |
| `eslint-plugin-storybook ^0.11.0` | Pre-1.0, may lag                                                                 |
| `@eslint/js` version              | Currently `^9.39.2` — needs v10-compatible version                               |
| Node.js version                   | ESLint 10 requires `^20.19.0 \|\| ^22.13.0 \|\| >=24`. Engines field says `>=18` |
| Peer dep                          | `peerDependencies: eslint ^9.0.0` needs `^10.0.0` added                          |

### Removed APIs in ESLint 10

- `context.getSourceCode()` → `context.sourceCode`
- `context.getCwd()` → `context.cwd`
- `context.getFilename()` → `context.filename`
- `context.getPhysicalFilename()` → `context.physicalFilename`
- `context.parserOptions` → `context.languageOptions`
- `context.parserPath` → removed
- `SourceCode.getTokenOrCommentBefore/After()` → `getTokenBefore/After({ includeComments: true })`
- `SourceCode.isSpaceBetweenTokens()` → `isSpaceBetween()`
- `SourceCode.getJSDocComment()` → removed
- `LegacyESLint`, `FileEnumerator` classes removed
- `/* eslint-env */` comments now produce errors
- CLI flags removed: `--no-eslintrc`, `--env`, `--resolve-plugins-relative-to`
- `ESLINT_USE_FLAT_CONFIG` env var removed

### Custom Rules Check

3 custom rules in `packages/cli/src/presets/typescript/eslint-rules/`:

- `no-accumulating-spread` — uses visitor pattern + `context.report()`, likely safe
- `no-incomplete-error-handling` — same pattern
- `no-re-export-all` — same pattern

Need to verify none use deprecated `context.getSourceCode()` etc.

## Dry-Run Results (2026-03-27)

Bumped `eslint@10.1.0` + `@eslint/js@10.0.1` in an isolated worktree.

### Blocker: Fatal crash on load

```
TypeError: Class extends value undefined is not a constructor or null
    at @typescript-eslint/utils/dist/ts-eslint/eslint/FlatESLint.js
```

ESLint 10 removed the `FlatESLint` export. `typescript-eslint@8.56.0` extends it → crash.
**Fix:** bump `typescript-eslint` to `8.57.2` (declares `eslint@^10` peer dep).

### Plugin Compatibility (verified via peer deps)

**Already support ESLint 10 (no action needed):**

- `eslint-plugin-import-x@4.16.2` — `^8 || ^9 || ^10`
- `eslint-plugin-unicorn@62.0.0` — `>=9.38.0`
- `eslint-plugin-jsdoc@62.8.0` — `^7 || ^8 || ^9 || ^10`
- `eslint-plugin-regexp@2.10.0` — `>=8.44.0`
- `eslint-plugin-astro@1.6.0` — `>=8.57.0`
- `eslint-plugin-playwright@2.10.0` — `>=8.40.0`
- `eslint-plugin-storybook@0.11.6` — `>=8`
- `eslint-plugin-simple-import-sort@12.1.1` — `>=5.0.0`
- `eslint-plugin-turbo@2.7.5` — `>6.6.0`
- `eslint-config-prettier@10.1.8` — `>=7.0.0`

**Plugin ESLint 10 compatibility (checked 2026-03-27):**

| Plugin                             | Status      | Detail                                                                                      |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `eslint-plugin-better-tailwindcss` | **Ready**   | v4.3.2 supports ESLint 10. Major bump from 3.8.0 → 4.x                                      |
| `eslint-plugin-sonarjs`            | **Ready**   | v4.0.2 supports ESLint 10. Major bump from 3.0.7 → 4.x                                      |
| `eslint-plugin-vitest`             | **Migrate** | Deprecated → renamed to `@vitest/eslint-plugin`. Latest (@1.6.13) peer `>=8.57.0` allows 10 |
| `eslint-plugin-jsx-a11y`           | **Blocked** | PRs #1079/#1081 open Feb 24-25, not merged                                                  |
| `eslint-plugin-react`              | **Blocked** | PR #3979 fixes removed APIs, not released. Runtime errors likely                            |
| `eslint-plugin-promise`            | **Blocked** | Works at runtime, peer dep not updated (issue #616)                                         |
| `@tanstack/eslint-plugin-query`    | **Blocked** | Issue #10141, no PR yet                                                                     |

### Custom Rules

3 custom rules are plain visitor objects with no ESLint API imports — **survive unchanged**.

### Not Yet Assessed

- New lint errors from `no-unassigned-vars`, `no-useless-assignment`, `preserve-caught-error` (crash prevented linting)
- Monorepo config lookup behavior change
- Safeword hooks config (same crash)

### Effort Estimate

**2-4 hours** for the 3 ready plugins + eslint core bump.
**Partially blocked** by 4 upstream plugins — `eslint-plugin-react` is highest risk (removed API usage). The other 3 blocked plugins likely work at runtime but lack peer dep declarations.

### Migration Plan (updated)

**Phase 1 — Do now:**

1. Bump `typescript-eslint` to `>=8.57.2` (unblocks everything)
2. Bump `eslint@^10.0.0` + `@eslint/js@^10.0.0`
3. Bump `eslint-plugin-better-tailwindcss` 3.8.0 → 4.x (major, check for rule changes)
4. Bump `eslint-plugin-sonarjs` 3.0.7 → 4.x (major, check for rule changes)
5. Migrate `eslint-plugin-vitest` → `@vitest/eslint-plugin`
6. Run lint — fix or disable new recommended rule violations
7. Test monorepo config resolution (per-file lookup vs CWD)
8. Update `engines` (Node >=20.19) and `peerDependencies` (eslint `^9.0.0 || ^10.0.0`)
9. Verify safeword hooks config works with new lookup

**Phase 2 — Wait for upstream:**

10. `eslint-plugin-react` — wait for PR #3979 release (runtime breakage risk)
11. `eslint-plugin-jsx-a11y` — wait for PRs #1079/#1081 merge
12. `eslint-plugin-promise` — works at runtime, bump when peer dep updated
13. `@tanstack/eslint-plugin-query` — wait for issue #10141 fix

**Decision needed:** Proceed with phase 1 now and override peer dep warnings for blocked plugins? Or wait until all 7 are ready?

## Work Log

- 2026-03-22 Created from audit. Current: 9.39.4, latest: 10.1.0.
- 2026-03-27 Completed research. Documented breaking changes, risk assessment, and migration plan.
- 2026-03-27 Dry-run in worktree. Found fatal blocker (`typescript-eslint` FlatESLint extends), 7 plugins without ESLint 10 peer deps.
- 2026-03-27 Checked all 7 plugins: 2 ready (tailwindcss, sonarjs), 1 migrate (vitest→@vitest/eslint-plugin), 4 blocked upstream (react, jsx-a11y, promise, tanstack-query).
