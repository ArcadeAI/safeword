# Verify — Ticket 153: Replan-on-Resume (design B)

## Verify Checklist

**Test Suite:** ✓ 2394/2394 tests pass (1 pre-existing skip; full suite, dist rebuilt via pretest)
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (eslint src+tests 0 warnings; typecheck 0 errors)
**Scenarios:** All 39 scenarios marked complete (9 [hook] SHA-annotated, 4 [agent] skip-annotated as live-verified)
**Dep Drift:** ✅ Clean (no CLI dependency changes — replan uses node builtins + existing libs only)
**Parent Epic:** N/A (153 is standalone — not part of the bdd-chain-hardening epic)
**Reconcile:** ✅ No pattern deviation — conformed to existing patterns (lib/ module, `lastReviewed*` precedent for the `replanPromptedHead` field, `checkbox-transitions.js` precedent for the `.js` sibling specifier)

## Audit

**Architecture:** ✅ No circular deps, no layer violations (depcruise: 122 modules, 351 deps; new `replan.ts` → `replan-relevance.ts` clean)
**Dead code:** ✅ None — all six new exports reachable (knip flags none; each used by its test, `evaluateReplan` also by `prompt-questions.ts`)
**Duplication:** ✅ No new clones introduced
**Learning files:** ✅ All carry `Covers:` line
**Test quality:** ✅ New tests assert specific values (`toEqual`, SHA `toMatch`, `toContain`), fresh per-test tmp repos, no arbitrary waits
**Security:** ✅ `runGit` uses `execFileSync` (no shell) — the file-derived `last_modified` passed to `git --since` cannot inject shell metacharacters (quality-review finding, fixed in 22b6f074; verified empirically). A systemic follow-up was filed for the repo's other `execSync`-with-interpolation git calls (notably `stop-quality.ts` `cat-file -e ${sha}` with an unvalidated annotation sha).

Errors: 0 | Warnings: 0

Audit passed

## Done-when coverage

- Silent when no commits since `last_modified` touch referenced paths → `no_commits_…`, `commits_touching_no_referenced_path_…`, `commit_touching_only_denylisted_manifest_…`, `ticket_with_no_path_signal_…` (unit + integration)
- Relevant commits surface a concise opt-in heads-up naming the count; decline is one step, runs no work → `relevant_commit_surfaces_opt_in_headsup` + SAFEWORD.md "Replan on resume"
- Accept runs a fresh `isolation: worktree` sub-agent, chat-only report (still-good/change/cancel/split/merge) → SAFEWORD.md prose ([agent] scenarios)
- Relevance compares commits' changed paths to referenced paths; irrelevant-only set does not fire → relevance fns
- Re-fire suppression via `replanPromptedHead` in session state; `last_modified` never bumped by the hook → `same_head_…`, `further_relevant_commit_…`, `surfacing_headsup_records_prompted_head`
- Sub-agent failure → note + proceed, no loop → SAFEWORD.md prose
- `templates/hooks/` ↔ `.safeword/hooks/` byte-identical → 118 parity pairs in sync

## Scope note

Ships the **textual** relevance signal (paths the ticket's artifacts name). The "∪ files the ticket has touched" history enrichment from dimensions.md decision 1 is **deferred** — at the resume boundary the ticket has usually edited nothing yet, and a `git log --grep=<id>` proxy risks the false positives this filter exists to suppress. No scenario requires touched-files presence to fire.

**Next:** Confirm to mark 153 done — then the remaining branch follow-ups are W9GPE7 (decomposition removal, unblocked) and opening the PR for `frosty-murdock-58ba0d`.
