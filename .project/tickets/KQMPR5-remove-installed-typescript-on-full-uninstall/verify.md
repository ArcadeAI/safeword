# Verify — remove-installed-typescript-on-full-uninstall (KQMPR5)

Full run at `7f4016f96` under `scripts/dev` (Bun 1.4.4). That commit includes 6SNC09's change of the ownership record to name → range Safeword wrote, which this ticket's uninstall path now follows.

## Verify Checklist

**Test Suite:** ✓ 11986/12004 tests pass (14 skipped). ⚠️ Local environment limitations: 2 Go failures (local Go 1.27.1 runs a 1.25.14 compiler; CI's Go tests pass) and an OpenCode download timeout under full-suite load; neither touches this change. The fourth failure, project-directory parity, was 6SNC09's and is fixed in `319ae0b15`.
**Gherkin:** ✅ Acceptance lane passes (599 scenarios)
**Build:** ✅ Success
**Lint:** ✅ Clean on changed files
**Typecheck:** ✅ Clean (`tsc --noEmit` in every package)
**Scenarios:** ⏭️ Skipped — patch ticket; the done_when items map to named tests below
**Refactor:** ✅ Completed — ownership recording extracted from `applySetup` into `recordSafewordOwnedPackages` (complexity), and ownership reads share helpers in `packs/config.ts`
**PR Scope:** ✅ Diff matches ticket scope (ownership record, uninstall removal gated on it, Bun-cache-proof detection, the preview entry for the record, tests)
**Dep Drift:** ✅ Clean — no new dependency
**Parent Epic:** 4ZRS4P (task, done)
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — `uninstall --agents=none --full` removes the typescript Safeword added and keeps one the project declared or later re-ranged
**Surface Evidence:** ✅ 1/1 affected surfaces have recorded proof (installed-project CLI: `tests/integration/typescript-validation.test.ts`, real installs and real uninstalls)
**Evidence limits:** ⚠️ Local Go toolchain mismatch and the OpenCode download timeout (above)

## done_when → proof

| done_when | Proof |
| --- | --- |
| `uninstall --full` after an install that added typescript removes it | `typescript-validation.test.ts` "removes the typescript it installed on full uninstall" (real installs) |
| `uninstall --full` after an install into a project that already declared typescript keeps it | `typescript-validation.test.ts` "keeps a typescript the project declared on full uninstall" and "keeps a typescript whose range the project changed on full uninstall" (real install, range edit, real uninstall; fails when ownership ignores the current range, checked by mutation); `owned-packages.test.ts` range handoff |
| A second identical install still reports no change | `typescript-validation.test.ts` "reports no change on a second identical install"; `cli-protocol/install-plan-completeness.test.ts` (no unplanned effects) |
| Under the Bun runtime, a project with no typescript in its node_modules is detected as lacking typescript | `project-detector.test.ts` "ignores the Bun global install cache when the CLI runs under Bun"; repository-root bound tests |

## Review

Codex cross-agent review `2c9c0a63` approved the ownership work; review `425eb4b2` approved the range-tied record change (6SNC09).

## Audit

Audit passed — diff-scoped at `0ef3a40fe`: no dependency violations (602 modules, 1092 dependencies cruised), no Python/Go/Rust changes.
