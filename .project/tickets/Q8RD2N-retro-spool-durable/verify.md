# Verify — Q8RD2N (#5467 part 3b)

## Verify Checklist

**Test Suite:** ✓ Full local suite at 66be2837f: 11,969 pass and 2 fail, both `lint-go-context` (local Go toolchain mismatch; this change touches no Go). Earlier, at 215d2e711: 11,957 tests pass and 4 fail. Two failures are `lint-go-context` (local Go toolchain mismatch; this change touches no Go). The other two were fixed in d21270b24: the closeout parity normalizer now names the new import, and the new tests simulate sandboxed writes with `tests/helpers/io-failure.ts`, not `chmod`. After that fix, retro-spool-worktree, closeout-cleanup and the permission tripwire pass 204/204. After the working-copy lock (6f1e30dd3), the retro, closeout and drain suites pass 371/371. After the test-quality, audit and refactor passes (0ced29458), retro-spool-worktree, retro-nudge, retro-filing and closeout-cleanup pass 538/538 (1 pre-existing skip).
**Test quality:** ✅ Reviewed against the testing skill. Real git worktrees, the real Stop hook, and only the filesystem boundary faked (`io-failure.ts`). Two gaps were closed in 5886bea27: the nudge's staging had no test, and the sandboxed-filing test did not prove the Stop hook copies acks into the shared folder. No eval or BDD tests are affected.
**Gherkin:** ⏭️ Not affected — no feature files or steps changed. CI runs the acceptance lane.
**Build:** ✅ Success
**Lint:** ✅ Clean (`bun run lint`, including `tsc`)
**Typecheck:** ✅ Clean
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md
**Refactor:** ✅ Completed — one module, `retro-draft-spool.ts`, owns both copies. Callers changed only where a spool path is handed to the filer (`stageRetroSpool`). The /refactor pass (0ced29458) named the durable removal ledger, added `mirrorRemovals` beside `mirrorAcks`, and fixed a stale comment. Deferred: caching the `git rev-parse` lookup. It is a performance change, not a structural one, and it would behave differently once a worktree is deleted.
**PR Scope:** ✅ Diff matches ticket scope: the durable copy and its ledgers, staging at the three handoffs, tests, and regenerated surfaces.
**Dep Drift:** ✅ Clean (no dependency changes)
**Parent Epic:** #5467 — part 4 (CLI and adapters) remains
**Reconcile:** ⚠️ Deviates from `.project/designs/5467-project-directory-resolution.md`, "Retro spool", as the ticket's Decision section records: the filer keeps the working copy, because Claude Code prompts before writes to `.git` and Codex's sandbox confines writes to the workspace.
**Experience:** ⏭️ N/A — nothing user-facing changes. Findings that used to be deleted with a worktree are now filed.
**Surface Evidence:** ✅ Drafts are spooled from a real linked worktree, which is then removed three ways (`git worktree remove`, deleting the folder plus `git worktree prune`, and a `--relative-paths` worktree). The real Claude Stop filing hook, run from the primary checkout, then dispatches the draft. Codex and Cursor stops call the same `decideRetroFilingGate`.
**Evidence limits:** ⚠️ Local Go toolchain mismatch; CI on the final head is authoritative for those tests.

Audit passed (/audit, diff scope against origin/main). No dependency violations (`depcruise --affected`), and the depcruise config is current. No learnings, agent configs or domain docs changed. One documentation gap was fixed in 0b085e733: `self-report-filing.md` now describes the shared copy. Knip, duplication and dependency-freshness checks are repository-scope only, so they were skipped.

## Notes

- Cross-agent quality-review (codex gpt-6.1-sol, independence: cross-agent) approved 0205b889 on pass 9. Pass 10 found one more race (staging replacing the working copy during a fallback append), fixed with a lock beside the working copy. b86344be approved that code. After the test-quality, audit and refactor passes, five more passes (with `jsonl-spool.ts` and `drain-retro-spool.ts` now in context) found four defects, each fixed with a test:
  - a fallback append that gave up on a busy lock after 2 seconds and appended anyway (3d08765c9, b6245a9b2: no deadline now);
  - closeout replacing the surviving checkout's spool instead of merging it (c3a90ceaa);
  - a torn last line swallowing the next append (d6d796f66);
  - two writers both passing the shared copy's cap (66be2837f).
  The class fix for the concurrency findings: every capped append and every rewrite of a spool file takes that file's lock. d5e353df approved the final code (cross-agent, no findings), with the ticket as a target, and stamped intake. The implement-phase stamp is a recorded skip, because review packets cannot carry the generated mirrors.
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
