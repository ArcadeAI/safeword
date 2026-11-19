# Verify — keep-safeword-files-out-of-project-checks (D16BY4)

Full run at `c9de58bda` under `scripts/dev` (Bun 1.4.4).

## Verify Checklist

**Test Suite:** ✓ 12025/12041 tests pass (14 skipped). ⚠️ Local environment limitation: 2 failures in `tests/hooks/lint-go-context.test.ts`, because this machine's Go 1.27.1 runs a 1.25.14 compiler; no Go code changed, and CI's Go tests pass.
**Gherkin:** ✅ Acceptance lane passes (599 scenarios). The stop hook's own runs fail 4 to 8 scenarios because the app's PATH puts mise's global Bun 1.3.14 first ("Unknown lockfile version") or because a run overlapped this one's `dist/` rebuild; the same scenarios pass here.
**Build:** ✅ Success
**Lint:** ✅ Clean on changed files
**Typecheck:** ✅ Clean (`tsc --noEmit` in every package)
**Scenarios:** ⏭️ Skipped — patch ticket; the done_when items map to named tests below
**Refactor:** ✅ No change warranted — the lookup is split into `readProjectSafewordConfig` and `configuredStepsDirectory` and reuses the step extension list; nothing else is duplicated
**PR Scope:** ✅ Diff matches ticket scope (the relocated-lane override, its tests, the parity allowlist entry, and the tsc regression test; the scaffolded tsconfig is unchanged as scoped)
**Dep Drift:** ✅ Clean — no new dependency
**Parent Epic:** 4ZRS4P (task, done)
**Reconcile:** ✅ No pattern deviation — reads `paths.steps` the same way `cucumber.mjs` does
**Experience:** ✅ No new friction — a project that moved its BDD steps with `paths.steps` gets the same step-file lint exemption as the default folders, whether ESLint runs from the root or a subfolder
**Surface Evidence:** ✅ 1/1 affected surfaces have recorded proof (installed-project checks: `tests/integration/typescript-validation.test.ts`, real installs, 22/22)
**Evidence limits:** ⚠️ Local Go toolchain mismatch (above); it touches no part of this change.

## done_when → proof

| done_when | Proof |
| --- | --- |
| A step module in a relocated paths.steps folder is allowed its import-time cucumber calls | `scaffold-lint-clean.test.ts` "allows them in a lane relocated with paths.steps" (preset loaded in the project, run from the root, a subfolder, and with a `./` prefix); each case also requires the file to be configured and parsed, and application code to stay flagged. Shown failing before the fix |
| tsc --listFilesOnly on a fresh Cursor install lists the scaffolded steps and no .safeword file | `typescript-validation.test.ts` "keeps vendored .safeword files out of the type-check (D16BY4)" (real installs). It passed before any change: TypeScript's `**` skips dot folders, which a minimal project confirmed, so it is a regression guard |

## Review

Codex cross-agent review requested changes three times: run from a subfolder, a negative control for application code under the reloaded preset, and a `./` prefix. The first two were fixed RED-first. The third was a false positive: ESLint normalizes `./` and trailing `/` in `files` patterns, which a direct ESLint check confirmed, and that case is kept as a test. Review `26b06e66` approved.

## Audit

Audit passed — diff-scoped at `c9de58bda`: no dependency violations (602 modules, 1092 dependencies cruised), no Python/Go/Rust changes.
