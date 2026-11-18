# Verify — K7WB3R (#5467 part 3a)

## Verify Checklist

**Test Suite:** ✓ Full local suite at e81e42996: 11,914 tests pass and 3 fail. Two failures are `lint-go-context` (local Go toolchain mismatch; this change touches no Go). The third was the plugin runtime's byte alignment for `closeout-binding.ts`, fixed in 4f1c8824f. After the last fix (ad26f53ba), the closeout suites (closeout-skill, closeout-binding-worktree, closeout-session-binding) pass 77/77, and closeout-host-adapters passes.
**Gherkin:** ⏭️ Not affected — no feature files or steps changed. CI runs the acceptance lane.
**Build:** ✅ Success
**Lint:** ✅ Clean (`bun run lint`, including `tsc`, at 4f1c8824f; the later hook changes type-check clean)
**Typecheck:** ✅ Clean
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md
**Refactor:** ✅ Completed — one `closeoutBindingTarget` decides for all three hosts. Segment-by-segment shell parsing was replaced by two exact allowed command shapes.
**PR Scope:** ✅ Diff matches ticket scope: the binding location for three writers, per-worktree file names, the deny on unfollowable commands, the gitignore pattern, tests and regenerated surfaces. The reconcile fix for retired gitignore paths is required by the pattern change.
**Dep Drift:** ✅ Clean (no dependency changes)
**Parent Epic:** #5467 — part 3b (retro spool) and part 4 remain
**Reconcile:** ✅ Follows `.project/designs/5467-project-directory-resolution.md`, "Closeout binding"
**Experience:** ⏭️ N/A — hook behavior. When a command is denied, the agent gets a one-line instruction it can follow at once.
**Surface Evidence:** ✅ The real Claude, Codex and Cursor hooks run with the session launched in the primary checkout of a real `git worktree` repository, and the binding lands where closeout reads it. The real closeout script, in the existing merged-PR fixture, adopts the primary-launched session from its worktree; a transcript naming another session is the control. Pointing the writer back at the launch checkout fails these tests.
**Evidence limits:** ⚠️ Local Go toolchain mismatch; CI on the final head is authoritative for those tests.

Audit passed — `depcruise --affected` against the merge base: no dependency violations (568 modules, 978 dependencies).

## Notes

- Cross-agent quality-review (codex gpt-6.1-sol, independence: cross-agent) approved f72ebe9b on pass 14, and a21db496 approved the same code for the intake stamp. Passes 4–13 found shell-form edge cases. The class fix was to stop interpreting shell: detection fails closed, and only `bun <trusted closeout script> <plain args>`, optionally after one `cd <absolute plain path> &&`, records a binding.
- The review context stated the trust boundary: the hook is a correctness aid for an honest agent, not a security control against deliberate evasion.
- Three final passes after that approval asked for: newlines treated as command separators (e2b971af); the denial to give the exact command to run (f92918b6); and a quoted plugin script path with spaces to be kept in that command (3c81b410). All are fixed and tested. The final review, 500fe103, approved and stamped intake.
- The recovery message is built from the agent's command at run time, so it carries no literal path for the plugin generator to rewrite. That had broken the plugin runtime's byte alignment.
- The implement-phase stamp is a recorded skip: review packets cannot carry the generated plugin mirrors, and the hand-written code is covered by the reviews above.
- Re-verified at c7149f55a after two CI-only fixes:
  - The audit job ignores GHSA-fc5q-39xc-vjpf. That picomatch advisory has no patched release, so the ignore follows the workflow's existing policy.
  - The closeout pattern is now a regex literal, which the host ESLint baseline requires, and it is byte-equivalent to the reviewed pattern.
  - CI is green on that head (CI run 44161247045), and locally the shipped-template ESLint baseline passes 4/4 and the closeout suites pass 77/77.
