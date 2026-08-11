# Work Log: Keep verification bound to the current work

**Anchored to:** `.project/tickets/Z24K1J-keep-verification-bound-to-current-work/ticket.md`

---

## Session: 2026-08-08

- [06:59] Started issue #2083 investigation. The reported symptom is verify resolving an unrelated `[path]` from active ticket state in a PR worktree.
- [06:59] Scope fixed: trace ticket-resolution precedence, reproduce with competing current-work and stale signals, then add a regression before changing behavior.
- [07:07] Reproduced: a fixture containing `AAA111-unrelated` and `ZZZ999-current` returns `AAA111` because the verify snippet pipes glob order to `head -1`.
- [07:07] PR #1991 changes ticket `4DK9H4`, which is already `done`; the in-progress filter necessarily discards the ticket tied to the PR and scans unrelated backlog state.
- [07:07] Ruled out namespace-root drift (helper returns this worktree's `.project`) and status parsing failure (the PR ticket has valid `status: done`).
- [07:07] Root cause checkpoint complete; ticket subtype advanced to `bug-investigated`.
- [07:07] Added regression contract across template, dogfood Claude, and generated Codex verify surfaces: require current-diff evidence, reject global `head -1`, fail closed on ambiguity, and continue ticketless with no evidence.
- [07:07] Implementation uses session-bound `TICKET_PATH` first; fallback combines branch diff, working-tree diff, and untracked paths under the configured namespace.
- [07:07] Manual proof: the session-bound Z24K1J path resolves; without a binding this dirty workspace reports all three changed ticket candidates and exits 1 instead of selecting one.
- [07:07] Parity synchronizer changed only the two expected dogfood mirrors; Codex catalogue regenerated. `parity-check --mode=all` and `git diff --check` pass.
- [07:21] Focused verification green: verify-skill contract 56/56; relay suite 167 passed, 1 skipped; both package builds succeeded.
- [07:29] Final full run: relay 167 passed/1 skipped; CLI 7,029 passed/40 skipped with 8 setup failures across four unrelated Python integration files. Every failure requests Python tools introduced by the separate active Python-readiness work; no failing path touches the verify skill or its contract test.
- [07:29] Ticket criteria and inline tests checked; phase advanced to verify. Status deliberately remains in_progress because ticket workflow requires user confirmation before done.

## Review Pass: 2026-08-08

- [07:32] Quality-review plan: (1) prove session binding and current-diff precedence solve #2083; (2) challenge zero/multiple/terminal-ticket boundaries; (3) verify Git and shell primitives against current primary documentation; (4) apply the deletion test for avoidable complexity; (5) send the canonical template, generated mirrors, and regression through the shared independent-review coordinator.
- [07:32] Refactor plan: build a complete smell ledger from quality-review + audit evidence, then apply each justified behavior-preserving change one at a time with the focused contract after every edit.
- [07:32] Audit plan: run the required diff-scoped executable blocks and manually separate findings caused by 2083 from the substantial pre-existing branch/worktree diff.
- [08:46] Quality-review pass 1 requested changes: static-only coverage, incomplete runtime session wiring, and a pre-existing verify-wide false-green exit path. Extracted an executable resolver and replaced string-only confidence with real temporary Git/session collaborators.
- [08:46] Refactor smell ledger: [resolved] 77-line inline shell / wrong abstraction → schema-managed helper; [resolved] static coverage theater → behavioral fixtures; [resolved] contradictory session/diff evidence → fail closed; [resolved] duplicated selection behavior across host surfaces → one canonical helper; [resolved] optional CLI and unborn-repository edges → explicit parsing and staged/unstaged coverage; [deferred/out-of-scope] verify-wide lane exit aggregation.
- [08:46] Final focused proof: relay 167 passed with 1 skipped; CLI helper/static/schema surface 102/102 passed, including the malformed `--ticket` regression.
- [08:46] Quality-review coordinator ran three times. Claude timed out each time, so independence degraded to a separate headless Codex reviewer. Every #2083-specific finding was addressed; the remaining error concerns the pre-existing one-shot verify shell's aggregate exit status.
- [08:46] Audit executable result: diff scope initialized from origin/main; Safeword check reported Healthy/Changed:no; dependency-cruiser found no violations across 317 modules and 480 dependencies; Knip, duplication, and freshness were correctly skipped in diff mode. Learning, principle-trace, and namespace-domain blocks emitted no findings.
- [08:46] Audit manual result: changed resolver tests use real Git/session collaborators, fresh temporary state, specific assertions, ambiguity/error boundaries, and table-driven unborn-repository cases. No changed AGENTS/CLAUDE/Cursor rule required review. Configured docs sources (`README.md`, website docs) contain no ticket-selection claim requiring an update.
- [08:46] Documentation/reference verification: resolver uses merge-base/three-dot branch comparison and `git ls-files --others --exclude-standard -z`, consistent with current primary Git documentation; NUL-delimited paths preserve unusual filenames.

## Revalidation: 2026-08-10

- [15:53 CDT] Caught up through moving-main waves, ending exactly at `3977112bc` (`origin/main`). Preserved each pre-merge state in named safety stashes; the last incoming commit changed only `PRINCIPLES.md` and did not affect #2083 code or proof.
- [15:53 CDT] Found one catch-up regression: the canonical verify skill had reverted to its old global `in_progress | head -1` scan while the helper, schema, and tests remained. Focused RED was 3 failures/99 passes; restored the canonical helper delegation and regenerated every mirror.
- [15:54 CDT] Resolved three post-stash conflicts in generated plugin artifacts by regenerating from combined canonical sources. Final parity: 253 pairs and 8 contracts synchronized, with no unmerged paths.
- [15:55 CDT] Final focused GREEN: 102/102 CLI resolver/schema/skill tests and 167 relay tests with 1 skipped. Live proof resolves explicit `Z24K1J`; the unbound shared worktree fails closed on multiple candidates.
- [15:55 CDT] Final authoritative full gate: 7,588 tests pass, 6 skip, and 36 unrelated shared-worktree tests fail; BDD remains red in unrelated active feature work. Both builds and TypeScript typechecks pass. Python mypy has one unrelated duplicate-module error. Bun audit and reachable Go vulnerability scan are clean; pip-audit is unavailable.
- [15:55 CDT] Audit re-run: healthy config, no dependency violations across 459 modules/832 dependencies, and no learning/principle/domain finding for #2083.
- [15:55 CDT] Quality/refactor re-pass: current primary Git/Node/Bun docs confirm the resolver primitives; independent coverage degraded after Claude timeout; fallback repeated only the pre-existing verify aggregate-exit defect. No additional #2083 refactor is justified.
- [17:53 CDT] Packaging: Replayed only #2083 canonical files, generated mirrors, schema registration, tests, and ticket evidence onto clean branch `codex/2083-keep-verification-bound` from `origin/main`. Clean relay (167 pass, 1 skip), parity, formatting, ESLint, builds, and TypeScript typechecks pass. The focused CLI wrapper waited 20 minutes for another worktree's live Vitest owner and exited without starting; the earlier identical 102/102 focused result remains the resolver evidence.
- [20:34 CDT] Behavioral hardening after brittleness review: merged the latest `origin/main`, added committed-PR, `origin/HEAD` nonstandard-default, missing-base fail-closed, and Codex-thread scenarios; isolated fixture Git configuration; and narrowed the verify-surface assertion to its executable command. Focused resolver/skill/schema proof passes 106/106; parity, formatting, ESLint, builds, and both TypeScript typechecks pass.
