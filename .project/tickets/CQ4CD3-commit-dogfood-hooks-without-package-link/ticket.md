---
id: CQ4CD3
slug: commit-dogfood-hooks-without-package-link
type: task
phase: intake
status: in_progress
created: 2026-06-26T06:41:31.737Z
last_modified: 2026-06-26T06:42:47Z
external_issue: https://github.com/ArcadeAI/safeword/issues/470
---

# Let maintainers commit dogfood hook changes without package-link setup

**Goal:** Make the normal protected commit path work in Safeword source worktrees when staged files trigger `.safeword` ESLint.

**Why:** Maintainers should not have to bypass Husky or hand-create `node_modules/safeword` links to commit verified dogfood hook changes.

**Type:** Bug

**Scope:** Fix Safeword's dogfood/source-worktree ESLint resolution path so `.safeword/eslint.config.mjs` can load `safeword/eslint` during pre-commit lint-staged runs. Cover the source repo and linked worktree case where the root does not contain `node_modules/safeword`.

**Out of Scope:** Changing Safeword's public ESLint preset API, weakening lint rules, or masking real ESLint config/plugin failures.

**Done When:**

- [ ] In a fresh Safeword source worktree after normal dependency/setup steps, staging `.safeword/hooks/*.ts` and running `git commit` does not fail with `ERR_MODULE_NOT_FOUND` for `safeword`.
- [ ] `.safeword/eslint.config.mjs` still fails loudly for genuine syntax errors, missing third-party plugins, and malformed project ESLint config.
- [ ] The fix does not require maintainers to set `HUSKY=0`, run a manual package link command, or edit generated `.safeword` config files.

**Tests:**

- [ ] Regression: source-worktree fixture or integration test proves the pre-commit/lint path can resolve `safeword/eslint` without a root `node_modules/safeword` link.
- [ ] Unit or integration coverage confirms the generated `.safeword/eslint.config.mjs` import path remains valid for normal installed projects.
- [ ] Existing ESLint config generation and lint hook tests continue to pass.

## Root Cause

The dogfood `.safeword/eslint.config.mjs` imports `safeword/eslint`. During a normal commit on branch `codex/464-quiet-implement-review-surface`, lint-staged invoked ESLint for staged `.safeword/hooks` files, but Node could not resolve the package from the worktree root because `node_modules/safeword` was absent. Manual verification passed, but the commit had to use `HUSKY=0` to bypass the broken protected path.

Possible fix directions:

- Make the dogfood/source repo config resolve the local workspace package path when running from a Safeword source checkout.
- Ensure Safeword setup/dogfood bootstrap creates the package link that the generated config expects.
- Route pre-commit lint for source repo `.safeword` files through a config that is guaranteed to resolve from the worktree root.

## Work Log

- 2026-06-26T06:42:47Z Filed: Created GitHub issue #470 and linked it from this ticket.
- 2026-06-26T06:41:26Z Found: Normal `git commit` failed because `.safeword/eslint.config.mjs` imports `safeword/eslint`, but the worktree root has no resolvable `node_modules/safeword`; committed #464 only after manual verification and `HUSKY=0`.
- 2026-06-26T06:41:31.737Z Started: Created ticket CQ4CD3
