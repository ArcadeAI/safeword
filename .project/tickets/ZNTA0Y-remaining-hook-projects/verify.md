# Verify — ZNTA0Y (#5664, #5467 part 2b)

## Verify Checklist

**Test Suite:** ✓ Full local `/verify` at 9bfbf5a08: 11,870+ tests pass. The only failures are `lint-go-context` (local Go toolchain mismatch; this change touches no Go) and an OpenCode `bunx` download timeout. Follow-up commits 4c4ad367e and 89dc272cb re-ran the affected suites (session-pointer hooks, remaining-hooks-follow-project, auto-upgrade project, parity guard): 40/40, also with `CI=true`.
**Gherkin:** ✅ Acceptance lane passes (599/599 scenarios) at 9bfbf5a08
**Build:** ✅ Success
**Lint:** ✅ Clean (`bun run lint`, including `tsc`, at 4c4ad367e; ESLint on the 89dc272cb test change)
**Typecheck:** ✅ Clean
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md
**Refactor:** ✅ Completed — shared `readSessionProjectDirectory` and `projectEnvironment` replace per-hook stdin and env handling
**PR Scope:** ✅ Diff matches ticket scope (hook migrations, `lib/lint`, crash capture, parity guard, tests, regenerated surfaces)
**Dep Drift:** ✅ Clean (no dependency changes)
**Parent Epic:** #5467 — parts 3 and 4 remain
**Reconcile:** ✅ No pattern deviation; follows the shared project rule in `.project/designs/5467-project-directory-resolution.md`
**Experience:** ⏭️ N/A — hook behavior, not persona-facing UI
**Surface Evidence:** ✅ Real hook processes run as the host runs them (`bun <hook>` with JSON stdin, cwd and `CLAUDE_PROJECT_DIR` at an unenrolled launch checkout) act on the enrolled worktree. Each case fails against main's hooks.
**Evidence limits:** ⚠️ Local Go toolchain mismatch; CI on the final head is authoritative for those tests.

Audit passed — `depcruise --affected` against the merge base: no dependency violations (572 modules, 978 dependencies).

## Notes

- Cross-agent quality-review (codex gpt-6.1-sol, independence: cross-agent): approved 1a5e9a94 after nine rounds on the full template and test set. Follow-up 9b594143 requested changes, because the auto-upgrade test checked only the entrypoint. That is fixed in 89dc272cb, which walks the import closure and was proven by a mutation of the dogfood `project-directory.ts`. f7cfb41e approved the fix.
- The implement-phase stamp is a recorded skip: the full-diff packet exceeds the 1 MB review limit because of the generated plugin runtimes. The hand-written code is covered by the reviews above.
