# Work Log: Commit dogfood hooks without package link

**Anchored to:** .project/tickets/CQ4CD3-commit-dogfood-hooks-without-package-link/ticket.md

---

## Session: 2026-07-02

- [09:11] Started: Revalidated GitHub issue #470 and local ticket CQ4CD3 before implementation.
- [09:11] Found: GitHub issue remains open; latest comment from 2026-07-02 reproduces `ERR_MODULE_NOT_FOUND` from repo root for `.safeword/eslint.config.mjs`, while `packages/cli` can resolve `safeword/eslint`.
- [09:13] Reproduced: `node --input-type=module -e "console.log(await import.meta.resolve('safeword/eslint'))"` fails from repo root; the same command resolves from `packages/cli`; `bunx eslint --config .safeword/eslint.config.mjs ...` fails before loading project config.
- [09:17] Figure-it-out: Compared generated-config fallback, source-root package export, dogfood-only config edit, and package-manager bootstrap. Picked package-manager bootstrap: add a root `devDependency` on `safeword: workspace:*` so `bun install` creates `node_modules/safeword -> packages/cli`. Temp Bun workspaces confirmed that a declared workspace dependency creates a root link even when the private root and workspace package both have name `safeword`.
- [09:23] Found: After package resolution was fixed, `.safeword/eslint.config.mjs` reached `../eslint.config.ts` and failed because the nested TypeScript config import was loaded by plain Node ESM instead of ESLint's `jiti` TypeScript config loader.
- [09:28] Verified: `bunx eslint --config .safeword/eslint.config.mjs packages/cli/tests/integration/review-stamp.test.ts`, root `import('safeword/eslint')`, focused tests, `tsc --noEmit`, and focused ESLint on changed TS files all pass. Also verified lint-staged's root-config ESLint command against `.safeword/hooks/lib/lint.ts`.
- [11:12] Catch-up/review: Moved detached worktree to `origin/main` (`b1355aff`) via stash replay, revalidated the issue checks, recorded `/quality-review`, checked current docs and package/security data, then refactored the new regression test to extract `runNodeFromRepoRoot`. Post-refactor focused tests, lint, typecheck, and diff check pass.
- [15:47] Audit fix: Recorded `/audit`; found generated hook ESLint config now imports `jiti` for `eslint.config.ts` but fresh installs did not request `jiti`. Added `jiti` to TypeScript pack base packages, added schema/reconcile assertions, and updated README, website configuration docs, and `ARCHITECTURE.md`.
- [15:58] Debugged BDD fallout: Full `test:bdd` first failed because two health-check fixtures were missing `jiti`; added it to both fixture devDependency maps. Canonical full `bun run test:bdd` now passes 181/181 scenarios and 3414/3414 steps.
- [16:33] Quality review: GitHub full-test CI exposed two remaining Vitest fixtures missing `jiti`; added it to the shared base fixture and self-verify fixture, tightened install behavior to `jiti@^2.2.0`, and reran the affected CI slice plus lint/typecheck/format gates green.
- [17:31] Done: User confirmed readiness; marked ticket done and prepared PR #615 to leave draft.
