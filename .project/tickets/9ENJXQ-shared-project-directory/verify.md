# Verify — 9ENJXQ (PR 1 of #5467)

## Verify Checklist

**Test Suite:** ✓ 11772/11772 tests pass at 471ad9b40 apart from 2 `lint-go-context` tests that fail only locally on a Go toolchain mismatch (`go1.25.14` vs `go1.27.1`) and pass in CI (14 skipped; plus retro-relay 153/153 and retro-collector 198/198). CI `test (node 22.23.2)` and `test (node 24.18.1)` are green at 471ad9b40.
**Gherkin:** ✅ Acceptance lane passes in CI at 471ad9b40. Locally 598/599 at that commit, and 1, 4 and 5 failures across reruns of identical code under concurrent test load from other sessions; the failing scenario (`review-with-the-best-available-agent.feature:81`, review routing) is untouched by this PR.
**Build:** ✅ Success
**Lint:** ✅ Clean (`bun run lint`: ESLint, Gherkin lint, `tsc --noEmit`)
**Typecheck:** ✅ Clean (`tsc --noEmit`, 0 errors)
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md
**Refactor:** ✅ Completed — 6e736afb8 shares one upward `.git` walk (`nearestGitTree`) between `enrolledWorkingTree` and `insideGitTree`
**PR Scope:** ✅ Diff matches ticket scope (new `project-directory.ts`, six hooks migrated including `post-tool-work-log` after #7357, old resolvers removed, TypeScript-parsed parity guard, schema entry, design-doc alignment, regenerated mirrors and Cursor lifecycle fixtures)
**Dep Drift:** ✅ Clean (no dependency changes)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — not persona-facing (internal project resolution)
**Surface Evidence:** ✅ 1/1 — the branch was installed into a fresh enrolled project with a git worktree and the installed hooks were driven with `CLAUDE_PROJECT_DIR` at the main checkout; 10/10 cases resolved as designed at e2684c12e (resolver unchanged in behavior since)
**Evidence limits:** ⚠️ Local Go toolchain mismatch and a flaky local acceptance lane under concurrent load; CI at 471ad9b40 is the authoritative run for both and is green.

Audit passed — diff audit at 9356f10b6: no dependency-cruiser violations (568 modules), config current; one documentation-drift error (design rule list) fixed in 9356f10b6.

## Notes

- Cursor `cursor-install.json` / `cursor-uninstall.json` result hashes changed because a Cursor install now ships `.safeword/hooks/lib/project-directory.ts` (same effect PR #5571 had when adding `ticket-close.ts`).
- Review: cross-agent quality-review through the coordinator (Codex `gpt-6.1-sol`, independence: cross-agent) plus five high-effort Codex passes during the catch-up with main. Every in-scope error was fixed with a test that fails on the previous code: #7357's work-log compile break, the outside-git edit fallback, the work-log owner fallback, and enrollment checked on the owning project. The last coordinator pass flagged #7357's learnings-nudge identity in `post-tool-quality.ts`, which is unchanged from main and outside this ticket.
- Behavior change: tools other than edits and Bash now resolve from the host `cwd` instead of always using the launch checkout.
- Parity guard (951d5647b) now detects every route the design names — `CLAUDE_PROJECT_DIR` reads, `?? process.cwd()` root fallbacks, `.git`/`.safeword` walk-ups and `--show-toplevel` — 23/23 parity tests pass; ten newly caught files are listed for parts 2 and 4. Cross-agent quality-review 0f3c48cc (codex gpt-6.1-sol) approved at 951d5647b.
- Implement-phase stamp is a recorded skip: one coordinator receipt cannot cover the hand-written source plus the ~40 generated plugin/codex-plugin mirrors within the 1 MB packet limit; the approving review above covered all hand-written source and tests.
