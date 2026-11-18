# Verify — Q8RD2N (#5467 part 3b)

## Verify Checklist

**Test Suite:** ✓ Full local suite at 215d2e711: 11,957 tests pass and 4 fail. Two failures are `lint-go-context` (local Go toolchain mismatch; this change touches no Go). The other two were fixed in d21270b24: the closeout parity normalizer now names the new import, and the new tests simulate sandboxed writes with `tests/helpers/io-failure.ts`, not `chmod`. After that fix, retro-spool-worktree, closeout-cleanup and the permission tripwire pass 204/204. After the working-copy lock (6f1e30dd3), the retro, closeout and drain suites pass 371/371.
**Gherkin:** ⏭️ Not affected — no feature files or steps changed. CI runs the acceptance lane.
**Build:** ✅ Success
**Lint:** ✅ Clean (`bun run lint`, including `tsc`)
**Typecheck:** ✅ Clean
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md
**Refactor:** ✅ Completed — one module, `retro-draft-spool.ts`, owns both copies. Callers changed only where a spool path is handed to the filer (`stageRetroSpool`).
**PR Scope:** ✅ Diff matches ticket scope: the durable copy and its ledgers, staging at the three handoffs, tests, and regenerated surfaces.
**Dep Drift:** ✅ Clean (no dependency changes)
**Parent Epic:** #5467 — part 4 (CLI and adapters) remains
**Reconcile:** ⚠️ Deviates from `.project/designs/5467-project-directory-resolution.md`, "Retro spool", as the ticket's Decision section records: the filer keeps the working copy, because Claude Code prompts before writes to `.git` and Codex's sandbox confines writes to the workspace.
**Experience:** ⏭️ N/A — nothing user-facing changes. Findings that used to be deleted with a worktree are now filed.
**Surface Evidence:** ✅ Drafts are spooled from a real linked worktree, which is then removed three ways (`git worktree remove`, deleting the folder plus `git worktree prune`, and a `--relative-paths` worktree). The real Claude Stop filing hook, run from the primary checkout, then dispatches the draft. Codex and Cursor stops call the same `decideRetroFilingGate`.
**Evidence limits:** ⚠️ Local Go toolchain mismatch; CI on the final head is authoritative for those tests.

Audit passed — `depcruise` on the changed modules: no dependency violations. New imports are `node:child_process` and `node:fs` only.

## Notes

- Cross-agent quality-review (codex gpt-6.1-sol, independence: cross-agent) approved 0205b889 on pass 9. Pass 10 found one more race (staging replacing the working copy during a fallback append), fixed with a lock beside the working copy. b86344be approved the final code with the ticket as a target, and stamped intake. Its one warning is the documented tradeoff: a fallback append that waits past 2 seconds appends anyway rather than drop a draft. The implement-phase stamp is a recorded skip, because review packets cannot carry the generated mirrors.
- Passes 1–8 found real defects, all fixed with tests:
  - acks lost with the worktree;
  - a failed staging that still dispatched;
  - a filed ack hiding a server-routed draft;
  - an unprunable server acceptance;
  - a rewrite racing an append;
  - a stale staging write;
  - a handoff file holding removed drafts;
  - a cap-crossing fallback.
- The class fix behind passes 3–6: the durable copy is append-only, and every removal is a ledger entry recorded before any rewrite.
- Known limit, recorded in the ticket: a sandboxed filer whose worktree is deleted before its turn's Stop hook runs keeps its acks only in that worktree. The filer's marker dedup is the backstop.
