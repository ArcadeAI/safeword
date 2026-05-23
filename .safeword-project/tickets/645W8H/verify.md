# Verify — ticket 645W8H

Per-worktree re-entry brief (Stop-hook log + SessionStart injection + status-line ambient).

Refreshed 2026-05-23T00:30Z on HEAD = a775ee1 (after rebase onto origin/main `726fc30`).

## Verify Checklist

**Test Suite:** ✓ 2001/2001 tests pass (1 skipped, 0 failed) — 115 test files, full suite `bun run test` from `packages/cli/`, duration 859s. Re-run after rebase onto current main; the +20 tests vs the pre-rebase 1981 are from main's PR #134 (learning-verification-stamps).
**Build:** ✅ Success (`bun run build` in `packages/cli/` — ESM + DTS).
**Lint:** ✅ Clean (`bun run lint:eslint`, `bun run format`, `bunx tsc --noEmit` — all silent).
**Scenarios:** All 64 scenarios marked complete (`grep -c '^- \[x\]'` = 64; `grep -c '^- \[ \]'` = 0 in `test-definitions.md`).
**Dep Drift:** ✅ Clean — no new `package.json` dependencies introduced by this branch. New runtime files are internal hook libs + a status-line script. `ARCHITECTURE.md` mentions every architectural dep (commander, yaml, astro, starlight, tsup, vitest, typescript). ESLint-plugin packages excluded per skill triage rule (tooling).
**Parent Epic:** N/A (feature has no `parent:` field).

## Audit

Audit passed. (Numbers reflect the audit at HEAD before rebase; rebase only changed the base, not this branch's diff. Full-suite re-run on post-rebase HEAD confirmed 2001/2001 green.)

- **Architecture (depcruise):** no dependency violations.
- **Dead code (knip):** clean. The initial run flagged `packages/cli/templates/statusline/reentry.ts` because the new templates dir wasn't covered by `knip.json` `ignoreFiles`. Extended the existing `templates/hooks/**` pattern to also cover `templates/statusline/**` in commit `0cde744`.
- **Duplication (jscpd):** 95 clones, 1.83% lines / 2.11% tokens — all pre-existing, none introduced by this branch's new modules.
- **Outdated deps:** 3 dev-only updates available — `knip` 6.14.1 → 6.14.2 (patch, Low), `eslint-plugin-jsdoc` 62 → 63 (major, Medium), `eslint` 9 → 10 (major, High). All deferred to dedicated migration tasks (matches J7VBGJ standing position).
- **Learning files:** all conform to the `Covers:` line-3 convention (no `[W006]` flags).
- **Agent configs:** CLAUDE.md = 33 lines, AGENTS.md = 176 lines, ARCHITECTURE.md = 525 lines, SAFEWORD.md = 198 lines — all within sane bounds.

## What this feature delivers

Three sites of context recovery for per-worktree re-entry, designed in concert:

1. **Stop-hook log** ([re-entry.ts](.safeword/hooks/lib/re-entry.ts)) — appends one line per turn to `.safeword-project/re-entry.md`, shape `<ISO-timestamp> <session-id> ticket=<id>/<phase> Next: <imperative>`. Deterministic fields are hook-injected from Stop-hook stdin + ticket frontmatter; only the `Next: <imperative>` is regex-extracted from the assistant's final message. POSIX append, atomic for sub-PIPE_BUF writes.
2. **SessionStart injection** ([session-start-reentry.ts](.safeword/hooks/session-start-reentry.ts)) — reads the log tail, filters by current session_id, injects the last 3 matching entries silently via `additionalContext`. Fresh `claude` (no session match): shows the single most-recent entry across all sessions tagged "(from another session)". On detected conflict (another session edited a file in its last 10 turns AND that file is dirty in `git status`): includes a one-line warning naming the file(s).
3. **Status-line script** ([reentry.ts](.safeword/statusline/reentry.ts)) — reads the same log tail, calls the shared conflict-detection lib, emits an ambient one-line indicator for the user's glance. On conflict: prepends `⚠️ conflict: <file>` before the Next: imperative. Silent otherwise.

Three slices, all delivered. 64/64 scenarios closed (8 rules × ~3 R/G/R sub-checkboxes per scenario row, by the per-scenario annotated-checkbox ledger from J7VBGJ).

## Multi-session behavior

Two concurrent sessions in one worktree are first-class:

- Append-only writes (atomic under PIPE_BUF) — no interleaving.
- Session-tagged lines — filtering at SessionStart is by `session_id`.
- Conflict signal is silent unless real (file-edited-recently AND currently-dirty); avoids "you have N other sessions" noise.

## Next:-extraction rule

Regex matches the **last** `**Next:** <imperative>` occurrence in the assistant's final message (Phase 4 refinement). Aligns with the SAFEWORD.md "end with the call" voice rule. Absence of `**Next:** ...` → no log entry (no garbage entries with empty intent). No-active-ticket case renders `ticket=∅/freeform` with the imperative.

## Defect found at verify

The verify run caught a schema-completeness bug introduced by this branch:

- `.safeword/statusline/reentry.ts` was registered in `SAFEWORD_SCHEMA.ownedFiles` but its parent `.safeword/statusline` was missing from `ownedDirs`.
- At uninstall, `removeIfEmpty('.safeword/statusline')` was never planned (non-recursive `rmdirSync`), so the now-empty directory survived. That empty subdir then made `removeIfEmpty('.safeword')` fail — `.safeword/` directory survived too.
- Symptom: 4 failing tests (`tests/commands/reset.test.ts` 11.2 / 11.4 / 11.7 plus `tests/reconcile.test.ts > uninstall mode`), all asserting `.safeword/` is gone after `safeword reset`.

Fix in commit `0cde744`:

1. Add `'.safeword/statusline'` to `SAFEWORD_SCHEMA.ownedDirs` (one line; the actual repair).
2. New structural test in `packages/cli/tests/schema.test.ts` — every `dirname(ownedFile)` must be in `ownedDirs` / `sharedDirs` / `preservedDirs`, or match the `.claude/*` auto-cleanup path in `reconcile.ts`. Catches the "owned file under unregistered directory" bug class by construction. Verified by reverting the schema entry: test fails with `'.safeword/statusline/reentry.ts' needs '.safeword/statusline' in ownedDirs/sharedDirs/preservedDirs`.
3. Extend `knip.json` `ignoreFiles` to cover `templates/statusline/**` (same pattern as the existing `templates/hooks/**` entry).

## Rebase note

This branch was rebased onto `origin/main` after PR #133 was squash-merged. The squash on main (commit `920b578`) was byte-identical to PR #133's tip (`be08fec`), so `git rebase --onto origin/main be08fec` cleanly replayed our 17 incremental commits with no manual conflict — git's 3-way auto-merge handled the only overlap (`packages/cli/src/schema.ts`, where main and this branch both made additive changes to different parts of the schema object).

## Out of scope (kept honest)

- Cross-worktree dashboard (Option B from figure-it-out) — pointless without per-worktree artifact existing; possible follow-up.
- Auto-trim / TTL on the log file — Phase 2 if size becomes a problem.
- SDK `memory_20250818` integration — useful but beta-primitive dependency; revisit after this ships.
- Retrospective state on the line (last test verdict, dirty count) — promoted to scope only if it would change the agent's next action. Current candidates don't clear that bar.

## Commits on branch

17 commits between `origin/main` (`726fc30`) and HEAD (`a775ee1`). The final arc:

```
a775ee1 chore(645W8H): advance phase verify → done; status → done
98540f8 chore(645W8H): verify artifact — full suite green on post-rebase HEAD
0cde744 fix(645W8H): register .safeword/statusline in ownedDirs + guard test
d7d4ca3 chore(645W8H): all 21 scenarios closed; advance phase implement → verify
aa5d8d9 chore(645W8H): close Rule 8 — 8.2 GREEN, 8.3 GREEN
f379ddc test(645W8H): scenario 8.3 — statusline silent when no entries (regression)
b662a2e feat(645W8H): GREEN scenario 8.2 — statusline conflict prefix
7929e0b test(645W8H): RED scenario 8.2 — statusline conflict prefix
2db50f8 refactor(645W8H): extract shared re-entry lib (deferred from scenario 1.1)
5fa59d8 chore(645W8H): close scenario 8.1
2b9037c feat(645W8H): GREEN scenario 8.1 — statusline prints latest Next:
f3f133d test(645W8H): RED scenario 8.1 — statusline surfaces latest Next:
```

Full history: `git log origin/main..HEAD --oneline`.
