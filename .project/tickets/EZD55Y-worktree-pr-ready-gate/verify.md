# EZD55Y — Verify (patch)

`gh pr ready` from a session inside `.claude/worktrees/<name>` is judged
against that worktree's ticket, session state, and readiness receipt, and the
PostToolUse observer records the receipt in the same worktree. PR #5382;
originating report PR #5376 (ticket 0FPHQM).

## Verify Checklist

**Test Suite:** ✓ 557/557 tests pass — targeted vitest on head `bdd78a97c` (22 files: pr-readiness-delivery-gate, namespace-root-helpers, quality-gates, pr-readiness-guard, post-tool-review, review-stamp, phase-derivation, loc-gate-merge, closeout-host-adapters, closeout-session-binding, cursor-post-tool-transcript, re-entry-stop, hook-coverage, codex-plugin-version, origin-main-contract, bash-ledger-write-gate, inspiration-intake-transition, process-kill-guard, plan-transition-gate, codex-stop-retro, write-time-annotation-gate, schema). Full suite runs in CI on the final head.
**Gherkin:** ⏭️ Skipped — patch; no acceptance lane or `.feature` source changed
**Build:** ✅ Success (tsup build runs before every vitest invocation)
**Lint:** ✅ Clean (eslint + prettier via pre-commit on every commit)
**Typecheck:** ✅ Clean (`tsc --noEmit` in packages/cli)
**Scenarios:** ⏭️ Skipped — patch (no test-definitions.md; scenario gate is feature-only)
**Refactor:** ✅ No change warranted — the shared resolvers (`resolveToolProjectDirectory`, `canonicalEditTarget`) already remove the pre/post duplication
**PR Scope:** ✅ Diff matches ticket scope — hook templates (namespace-root, pre-tool-quality, post-tool-quality), their `.safeword/hooks` mirrors, regenerated plugin/codex-plugin/catalogue surfaces, refreshed Cursor lifecycle fixture hashes, and the two test files
**Dep Drift:** ✅ Clean — no dependencies added
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — extends the #5247/#5362 owning-worktree resolution to Bash and the observer
**Experience:** ⏭️ N/A — not persona-facing (gate plumbing)
**Surface Evidence:** ✅ 1/1 — Claude Code PreToolUse/PostToolUse hooks driven as subprocesses with CLAUDE_PROJECT_DIR = launch checkout and `cwd` = enrolled worktree
**Evidence limits:** ✅ None

## Regression evidence (RED → GREEN)

- Worktree shell, done + verified worktree ticket: `gh pr ready` denied before, allowed after.
- Launch-checkout shell or unfinished worktree ticket: still denied.
- Codex cross-agent review findings fixed test-first: ticket closed through an alias outside `.project/tickets`; shell cwd reached through a symlink into the worktree; relative edit targets resolved against the session cwd.

## Out of scope (reported, not fixed)

- `readConfiguredPathValue` in `hooks/lib/namespace-root.ts` throws when `.safeword/config.json` is the JSON literal `null` (pre-existing; Codex review a4e654f7).
- `safeword install` refuses to run inside a `.claude/worktrees/<name>` checkout (nested-project check).
- Codex/Cursor adapters do not forward `cwd`, so they keep launch-checkout behavior.
