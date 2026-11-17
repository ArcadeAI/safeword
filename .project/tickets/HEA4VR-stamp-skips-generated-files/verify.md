# Verify — HEA4VR

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: 11848/11852 pass (14 skipped); the 4 failures are the local Go toolchain mismatch (`compile: version "go1.25.14" does not match go tool version "go1.27.1"`, 2 tests in `tests/hooks/lint-go-context.test.ts`) and OpenCode/review-probe timeouts (`bunx --bun opencode-ai@1.18.23 --version` timed out; `REVIEW_ROUTES_EXHAUSTED` in `tests/cli-protocol/review-wiring.test.ts`). Targeted: `tests/hooks/stamp-coverage-generated.test.ts`, `tests/hooks/review-receipt.test.ts`, `tests/integration/review-receipt-wiring.test.ts` ✓ 83/83 tests pass. CI is fully green at `24e03d8`, which contains the final implementation and all follow-up tests (later commits touch only this ticket folder): test (node 22.23.2), test (node 24.18.1), lint, Go lint context 2.0.0 and 2.13.2, OpenCode conformance, Dogfood parity, CLI contract and Dependency audit all pass. The same Go and OpenCode lanes fail only locally, which confirms those failures are environment-only.
**Gherkin:** ✅ Acceptance lane passes (599/599 scenarios, 11786 steps)
**Build:** ⚠️ Local environment limitation: build lane fails only on the same Go toolchain mismatch; the TypeScript build (tsup/DTS) succeeds.
**Lint:** ✅ Clean (eslint + prettier via pre-commit)
**Typecheck:** ✅ Clean
**Scenarios:** ⏭️ Skipped — task ticket with no test-definitions.md; done_when items covered by the targeted tests above
**Refactor:** ✅ No change warranted — the stamp helper reads as resolve → isolate → query → parse; hook templates cannot import `packages/cli/src`, so the check-attr isolation is inlined instead of shared with `review/packet.ts`
**PR Scope:** ✅ Diff matches ticket scope (stamp coverage set, rejection message, staged-edit gap from cross-agent review; the rest is regenerated mirrors and fixtures)
**Dep Drift:** ✅ Clean (no dependencies added)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — reuses the isolated `git check-attr --source` approach from `review/packet.ts`
**Experience:** ⏭️ N/A — not persona-facing (agent workflow gate internals)
**Surface Evidence:** ✅ 1/1 affected surfaces have recorded proof — implement-phase stamp: `bun .safeword/hooks/write-review-stamp.ts --phase implement` on this branch accepted review `c22c0d71-3ef9-4aea-9169-b553e14d8b74` and, after the test additions, `ada533f1-7abc-4058-939e-647d73d60d62`; both covered only the hand-written files and left out the 8 `plugin/` and `packages/cli/codex-plugin/` mirrors
**Evidence limits:** ⚠️ Go toolchain mismatch and OpenCode/review-probe timeouts are local-only; CI at `24e03d8` passes the same lanes

## Review and audit

- Cross-agent quality review (Codex, gpt-6.1-sol): changes requested twice, both fixed: bare `linguist-*` declarations reported as `set`, and a staged edit reverted in the working tree. Approved on the third pass: `c22c0d71-3ef9-4aea-9169-b553e14d8b74`.
- Follow-up test gaps (requested by the coordinating session): added a fail-closed test (git `check-attr` or `init` fails → nothing exempted), a subfolder-project test (non-empty `--show-prefix`, project-relative paths), and split the self-exemption test into branch `.gitattributes` and `.git/info/attributes` cases. All passed on first run (characterization). Each was mutation-checked: dropping the repo prefix, failing open on a git error, reading the real `.git` attributes, and reading attributes from HEAD were each caught by exactly the intended test. Test review approved: `51eef44a-3c37-4f99-b8b8-57a0b061cade`; implement re-review approved: `ada533f1-7abc-4058-939e-647d73d60d62`.
- Refactor and docs-grounded quality review (after closure, at the user's request): extracted `enabledFiles` and `isolatedGitEnvironment` from `baseExemptFiles`, and a `withFailingGit` test helper. Sources checked: the git 2.40 release notes (`check-attr` learned to take an optional tree-ish), the `git check-attr` docs (`-z` output; "set" means defined as true), and the GitHub Linguist overrides docs (bare boolean form). Applied: the doc comment names the git 2.40/2.31 floor, which fails closed; and two wiring tests run the real `write-review-stamp.ts --phase implement` against a git repo (base-marked mirror is stamped, branch-marked mirror is refused naming it). The cross-agent re-review found that `git diff --name-only` drops a rename's source, so the coverage diffs now use `--no-renames` (RED-first test). The CI lint failure at `48bed0e` was a typecheck error from the refactor, now fixed. Final cross-agent review approved: `e892a4df-bc2b-48ba-8e21-f6b3e3ef81e3`.
- Audit passed — diff scope from origin/main: 0 errors, 0 warnings; no config drift, no dependency violations (7 modules), no doc drift.
