---
id: CQ4CD3
slug: commit-dogfood-hooks-without-package-link
type: task
subtype: bug-investigated
phase: done
status: done
created: 2026-06-26T06:41:31.737Z
last_modified: 2026-07-03T00:31:03Z
external_issue: https://github.com/ArcadeAI/safeword/issues/470
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/615
scope:
  - Fix Safeword's dogfood/source-worktree ESLint resolution path so `.safeword/eslint.config.mjs` can load `safeword/eslint` during pre-commit lint-staged runs.
  - Cover the source repo and linked worktree case where the root does not contain `node_modules/safeword` before dependency setup.
out_of_scope:
  - Changing Safeword's public ESLint preset API.
  - Weakening lint rules.
  - Masking real ESLint config/plugin failures.
done_when:
  - In a fresh Safeword source worktree after normal dependency/setup steps, staging `.safeword/hooks/*.ts` and running `git commit` does not fail with `ERR_MODULE_NOT_FOUND` for `safeword`.
  - `.safeword/eslint.config.mjs` still fails loudly for genuine syntax errors, missing third-party plugins, and malformed project ESLint config.
  - The fix does not require maintainers to set `HUSKY=0`, run a manual package link command, or edit generated `.safeword` config files.
---

# Let maintainers commit dogfood hook changes without package-link setup

**Goal:** Make the normal protected commit path work in Safeword source worktrees when staged files trigger `.safeword` ESLint.

**Why:** Maintainers should not have to bypass Husky or hand-create `node_modules/safeword` links to commit verified dogfood hook changes.

**Type:** Bug

**Scope:** Fix Safeword's dogfood/source-worktree ESLint resolution path so `.safeword/eslint.config.mjs` can load `safeword/eslint` during pre-commit lint-staged runs. Cover the source repo and linked worktree case where the root does not contain `node_modules/safeword`.

**Out of Scope:** Changing Safeword's public ESLint preset API, weakening lint rules, or masking real ESLint config/plugin failures.

**Done When:**

- [x] In a fresh Safeword source worktree after normal dependency/setup steps, staging `.safeword/hooks/*.ts` and running `git commit` does not fail with `ERR_MODULE_NOT_FOUND` for `safeword`.
- [x] `.safeword/eslint.config.mjs` still fails loudly for genuine syntax errors, missing third-party plugins, and malformed project ESLint config.
- [x] The fix does not require maintainers to set `HUSKY=0`, run a manual package link command, or edit generated `.safeword` config files.

**Tests:**

- [x] Regression: source-worktree fixture or integration test proves the pre-commit/lint path can resolve `safeword/eslint` without a manual root `node_modules/safeword` link.
- [x] Unit or integration coverage confirms the generated `.safeword/eslint.config.mjs` import path remains valid for normal installed projects.
- [x] Package reconciliation installs `jiti` anywhere generated hook ESLint config may load `eslint.config.ts`.
- [x] Existing ESLint config generation and lint hook tests continue to pass.

## Root Cause

The dogfood `.safeword/eslint.config.mjs` imports `safeword/eslint`. During a normal commit on branch `codex/464-quiet-implement-review-surface`, lint-staged invoked ESLint for staged `.safeword/hooks` files, but Node could not resolve the package from the worktree root because `node_modules/safeword` was absent. Manual verification passed, but the commit had to use `HUSKY=0` to bypass the broken protected path.

Possible fix directions:

- Make the dogfood/source repo config resolve the local workspace package path when running from a Safeword source checkout.
- Ensure Safeword setup/dogfood bootstrap creates the package link that the generated config expects.
- Route pre-commit lint for source repo `.safeword` files through a config that is guaranteed to resolve from the worktree root.

### Audit Fixture Root Cause

After adding `jiti` to the generated hook ESLint config path, the BDD health-check fixtures still hand-coded the old installed devDependency set. `safeword check --offline` therefore reported `Missing Packages: jiti` before reaching the intended surface and invalid-feature assertions. Confirmed by the failing Cucumber stdout and by comparing both fixture manifests with `typescriptPackages.base`.

Ruled out: a CLI regression in surface coverage reporting, because the output stopped at dependency readiness before evaluating the feature surface warning; a Gherkin parser regression, because the invalid-feature scenario also stopped before parser diagnostics.

### Quality Review CI Root Cause

The PR's full Vitest CI run still used older fixture manifests in `packages/cli/tests/helpers.ts` and `tests/commands/self-verify.test.ts`. Those fixtures represent projects with Safeword's base development tools already installed, so dependency readiness short-circuited the intended command assertions with `Missing Packages: jiti`. The fix adds `jiti` to those base fixtures and pins the generated install package to `jiti@^2.2.0`, matching ESLint's documented minimum for TypeScript config-file loading.

## Work Log

- 2026-07-03T00:31:03Z Done: User confirmed PR readiness after `/refactor` and `/audit`; ticket marked done with PR #615 ready for review.
- 2026-07-02T23:33:40Z Quality review follow-up: GitHub test CI exposed two remaining Vitest fixtures missing `jiti`; patched the shared base fixture and self-verify fixture, tightened install behavior from bare `jiti` to `jiti@^2.2.0`, and reran the affected CI slice plus lint/typecheck/format gates green.
- 2026-07-02T22:58:59Z Debugged post-audit BDD fallout: full `test:bdd` initially failed because health-check fixtures were missing the newly required `jiti` devDependency; patched both fixture manifests and reran the canonical full lane to 181/181 scenarios and 3414/3414 steps passing.
- 2026-07-02T22:47:22Z Audit fix: `/audit` found the generated hook ESLint config imports `jiti` but fresh installs did not request `jiti`; added it to TypeScript pack packages, covered package reconciliation/schema tests, and updated README/website/architecture docs for the devDependency.
- 2026-07-02T18:20:41Z Prepared PR branch `codex/470-dogfood-hook-package-link`: added `verify.md`, reran Gherkin acceptance and package build, and kept ticket status in progress pending explicit close confirmation.
- 2026-07-02T18:12:44Z Revalidated after catching up to `origin/main` (`b1355aff`): replayed the issue diff cleanly, reran root `import('safeword/eslint')`, `.safeword/eslint.config.mjs` ESLint, lint-staged root-config ESLint proxy, focused tests, focused lint, `tsc --noEmit`, and `git diff --check`. Quality review approved with no blocking findings; refactored the new regression test to name the root Node subprocess boundary.
- 2026-07-02T16:28:57Z Verified: Added root `safeword: workspace:*` devDependency, generated `.safeword` TS-config loading via `jiti`, and focused regressions. Passing: source-worktree test + config-template test, `tsc --noEmit`, focused ESLint on changed TS files, root `import('safeword/eslint')`, the original `.safeword/eslint.config.mjs` ESLint command, and lint-staged's root-config ESLint command against `.safeword/hooks/lib/lint.ts`.
- 2026-06-26T06:42:47Z Filed: Created GitHub issue #470 and linked it from this ticket.
- 2026-06-26T06:41:26Z Found: Normal `git commit` failed because `.safeword/eslint.config.mjs` imports `safeword/eslint`, but the worktree root has no resolvable `node_modules/safeword`; committed #464 only after manual verification and `HUSKY=0`.
- 2026-06-26T06:41:31.737Z Started: Created ticket CQ4CD3
