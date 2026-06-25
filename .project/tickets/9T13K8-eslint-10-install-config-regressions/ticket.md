---
id: 9T13K8
slug: eslint-10-install-config-regressions
type: task
phase: done
status: done
created: 2026-06-24T22:27:22.090Z
last_modified: 2026-06-25T00:04:54Z
external_issue: https://github.com/ArcadeAI/safeword/issues/388
external_issues:
  - https://github.com/ArcadeAI/safeword/issues/388
  - https://github.com/ArcadeAI/safeword/issues/389
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/418
---

# Prevent ESLint 10 install and config regressions

**Goal:** Ship the ESLint 10 follow-up fixes for the generated config crash and the `eslint-plugin-jsx-a11y` peer mismatch as one paired release.

**Why:** Safeword 0.55.0+ advertises ESLint 10 support, so fresh installs and generated hook configs must work without peer-check failures or runtime `ReferenceError`s.

**Type:** Bug

**Scope:** Fix package and generated-config behavior for GitHub issues #388 and #389. Keep the change limited to the ESLint 10 install/config surface and existing preset behavior.

**Out of Scope:** Dropping ESLint 9 support, replacing the full accessibility rule strategy unless required, changing root project lint rules, or changing unrelated templates.

**Done When:**

- [x] pnpm workspaces installing Safeword with ESLint 10 do not fail peer checks because of Safeword's bundled accessibility plugin.
- [x] Generated `.safeword/eslint.config.mjs` is self-contained for both formatter and formatter-agnostic paths.
- [x] Focused unit/release tests fail before the fix and pass after it.
- [x] Focused validation covers both GitHub issues.

**Tests:**

- [x] Unit: `.safeword` flat config generation never emits `safeword.prettierConfig` without importing `safeword`.
- [x] Release/package: Safeword's published dependency graph has no direct dependency whose ESLint peer excludes the advertised ESLint 10 range without mitigation.
- [x] Repro: pnpm peer check scenario for `safeword` + `eslint@^10` is validated after implementation.

## Work Log

- 2026-06-25T00:04:54Z CI fix: PR #418 test job failed in `tests/presets/lazy-config-loading.test.ts` because the old structural contract still required Astro to avoid top-level plugin imports. Documented Astro 2.1 as the ESM-only exception while keeping the lazy-loading assertion for CJS-loadable stack plugins. Verified focused failing suite (4 files / 86 tests), broader targeted suite (14 files / 275 tests), and package lint/typecheck.
- 2026-06-24T23:42:59Z Done: Opened PR https://github.com/ArcadeAI/safeword/pull/418, confirmed all ticket acceptance checks are covered, and marked ticket done with user confirmation.
- 2026-06-24T23:41:00Z Quality-review: Approved after Astro 2.1 follow-up. Verified `eslint-plugin-astro@2.1.0` is latest and declares ESLint 10 plus optional `eslint-plugin-jsx-a11y`; verified Astro docs still require `eslint-plugin-jsx-a11y` only for Astro a11y configs; verified `eslint-plugin-jsx-a11y@6.10.2` still peers only through ESLint 9; verified packed-consumer `pnpm audit` found 0 advisories. No critical issues. Release note should call out the Node engine tightening to `^22.22.3 || ^24.16.0 || >=26.3.0`.
- 2026-06-24T23:34:25Z Implemented Astro follow-up: upgraded `eslint-plugin-astro` to `~2.1.0`, matched Safeword's Node engine to Astro 2.1's runtime contract, switched Astro preset loading to ESM import, kept Astro jsx-a11y rules optional, and added tests for the expanded Astro recommended rules. Verified focused paired suite (3 files / 76 tests), packed pnpm consumer with `eslint@10.5.0` and no `eslint-plugin-jsx-a11y` (no peer issues, configs load), broader preset/schema suite (13 files / 265 tests), smoke-fast (46 files / 626 tests), and package lint/typecheck.
- 2026-06-24T22:52:00Z Quality-review: Approved. Verified pnpm settings/docs, Astro jsx-a11y docs, npm registry metadata, Snyk package security, packed-consumer audit, package lint, and smoke-fast. Non-blocking notes: `@eslint-react/eslint-plugin` is one patch behind (5.9.1 vs 5.9.2); `eslint-plugin-astro@2.1.0` is newer but now peers on `eslint-plugin-jsx-a11y`, so upgrading it would conflict with this regression fix.
- 2026-06-24T22:43:00Z Verified: `bun run test:smoke:fast` passed 46 files / 626 tests.
- 2026-06-24T22:42:00Z Verified: `bun run --cwd packages/cli test src/presets/typescript/eslint-configs/__tests__ src/templates/config.test.ts tests/schema.test.ts` passed 13 files / 262 tests.
- 2026-06-24T22:41:00Z Verified: `bun run --cwd packages/cli lint` passed (`eslint src tests`, Gherkin lint, typecheck).
- 2026-06-24T22:40:00Z Verified: Packed `safeword-0.56.0.tgz` installed with `eslint@10.5.0` under pnpm; `pnpm peers check` reported no issues and `safeword/eslint` loaded React and Astro configs.
- 2026-06-24T22:39:00Z Implemented: Moved `eslint-plugin-jsx-a11y` to devDependencies, added optional dependency resolution, made React/Astro a11y configs conditional, and added #389 template regression tests.
- 2026-06-24T22:37:00Z RED: Focused tests failed on current code for production `eslint-plugin-jsx-a11y`, static React import, and missing optional-config builders.
- 2026-06-24T22:35:00Z Decided: Remove `eslint-plugin-jsx-a11y` from Safeword's production dependency graph and make React/Astro a11y configs optional when the plugin is present. Package-manager metadata inside Safeword is insufficient because pnpm ignores dependency-local `peerDependencyRules` for consumer peer checks.
- 2026-06-24T22:34:00Z Reproduced: A pnpm fixture with `peerDependencyRules` inside a dependency package still fails `pnpm peers check` for `eslint-plugin-jsx-a11y@6.10.2` against ESLint 10.
- 2026-06-24T22:33:00Z Found: `@eslint-react/eslint-plugin@5.9.1` does not provide broad jsx-a11y parity; replacing jsx-a11y with it alone would drop semantic accessibility checks.
- 2026-06-24T22:32:00Z Found: `eslint-plugin-astro@1.7.0` documents that its Astro jsx-a11y configs require `eslint-plugin-jsx-a11y` installed, so Astro config must become conditional if the production dependency is removed.
- 2026-06-24T22:27:31Z Found: GitHub issues #388 and #389 are open and both target the ESLint 10 release surface.
- 2026-06-24T22:27:31Z Found: `eslint-plugin-jsx-a11y@6.10.2` is still latest on npm and still peers only through ESLint 9.
- 2026-06-24T22:27:31Z Revalidated: Current `getSafewordEslintConfigExtending` imports `safeword` when it emits `safeword.prettierConfig`; #389 needs an explicit regression test for the old 0.55.0 symptom rather than a fresh code fix.
- 2026-06-24T22:27:22.090Z Started: Created ticket 9T13K8
