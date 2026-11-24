# Verify — keep-javascript-lint-rules-for-javascript-apps (6SNC09)

Full run at `7f4016f96` under `scripts/dev` (Bun 1.4.4). The one product failure in it, the project-directory parity tripwire, was fixed in `319ae0b15` and that file then passed 23/23.

## Verify Checklist

**Test Suite:** ✓ 11986/12004 tests pass (14 skipped). ⚠️ Local environment limitations: (1) 2 failures in `tests/hooks/lint-go-context.test.ts`, because this machine's Go 1.27.1 runs a 1.25.14 compiler; no Go code changed, and CI's Go tests pass. (2) `opencode/host-contract` timed out downloading `opencode-ai` under full-suite load; no OpenCode code changed. (3) `tests/project-directory-parity.test.ts` flagged the new repository-root lookup in `project-detector.ts`; fixed in `319ae0b15` with an allowlist entry and its reason, then 23/23 pass.
**Gherkin:** ✅ Acceptance lane passes (599 scenarios). The stop hook's own runs reported 4 and then 8 failures; those used the machine's bare Bun 1.3.14 ("Unknown lockfile version") and overlapped this run's `dist/` rebuild, and the same scenarios pass here.
**Build:** ✅ Success
**Lint:** ✅ Clean on changed files
**Typecheck:** ✅ Clean (`tsc --noEmit` in every package)
**Scenarios:** ⏭️ Skipped — patch ticket; the done_when items map to named tests below
**Refactor:** ✅ Completed — `collectAllDependencies` filters owned packages instead of deleting keys; ownership reads share `readDeclaredDependencies` and `readOwnershipRecord`; the compiler lookup is split into `projectModuleFolders`
**PR Scope:** ✅ Diff matches ticket scope (detection, the JavaScript preset's TypeScript override, the range-tied ownership record its two Bugbot findings required, the bounded compiler lookup, their tests, regenerated surfaces, and the tightened promise-rule assertions Codex flagged)
**Dep Drift:** ✅ Clean — no new dependency; the JavaScript preset now uses `typescript-eslint`, which the package already ships for the TypeScript preset
**Parent Epic:** 4ZRS4P (task, done)
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — a JavaScript app upgraded with the TypeScript BDD lane keeps its JavaScript lint rules and JSDoc checks, and its `.ts` step files lint clean. Changing the `typescript` range hands the package to the project with no prompt
**Surface Evidence:** ✅ 1/1 affected surfaces have recorded proof (installed-project lint: `tests/integration/typescript-validation.test.ts`, real installs, 21/21 after KQMPR5's re-ranged-uninstall test was added)
**Evidence limits:** ⚠️ Local Go toolchain mismatch and the OpenCode download timeout (above); neither touches this change. One earlier full-file run failed the new JavaScript-rules integration test once, its log was lost, and the test has passed in every run since.

## done_when → proof

| done_when | Proof |
| --- | --- |
| A JavaScript app whose only typescript is Safeword-owned is detected as javascript | `detect.test.ts` "keeps a JavaScript app JavaScript when its only typescript is the one Safeword added", plus the range handoff case |
| The JavaScript preset lints a TypeScript step file without a parse error | `configs.test.ts` (real ESLint `Linter`): "lints valid TypeScript BDD step files clean", "parses TypeScript files outside the step folders" and "parses TSX files" assert no messages at all, so an unmatched-file warning fails them; "lints .ts/.tsx/.mts/.cts files … with the TypeScript rules" requires `@typescript-eslint/no-unused-vars` to fire, proving each extension is configured and parsed. Dropping `.tsx` from the override fails both TSX tests (mutation check) |
| A fresh JS-only install keeps JSDoc rules on its own source files | `typescript-validation.test.ts` "keeps JavaScript lint rules on the project files after adding typescript (6SNC09)" (real installs); shown failing before the fix |

## Review

Codex cross-agent review requested changes twice (step-file core rules and loose promise assertions; then TSX coverage and missing install context). Each was fixed RED-first, and review `425eb4b2` approved.

## Audit

Audit passed — diff-scoped at `0ef3a40fe`: no dependency violations (602 modules, 1092 dependencies cruised), no Python/Go/Rust changes.
