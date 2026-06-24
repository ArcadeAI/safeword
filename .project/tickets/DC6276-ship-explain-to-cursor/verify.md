# Verify — ship-explain-to-cursor (DC6276)

## Verify Checklist

**Test Suite:** ✓ 492/492 tests pass (done-gate lane; includes the new guard test "Cursor command for every action skill")
**Gherkin:** ✅ Acceptance lane passes (69 scenarios / 741 steps — unaffected)
**Build:** ⏭️ Skipped — no build step
**Lint:** ✅ Clean (eslint 0 errors on schema + test; markdownlint 0 on the new command)
**Scenarios:** ⏭️ Skipped — task, no test-definitions.md
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** K6CAJN (siblings: 3/8 done)
**Reconcile:** N/A — followed the existing cursor-command + schema-registration pattern

## What was verified

- **`.cursor/commands/explain.md` created** (template + byte-identical dogfood),
  mirroring the `/explain` skill, adapted to Cursor's command model — the
  read-only contract is encoded in prose ("Read-only … never edits") since a
  Cursor command can't set `disallowed-tools`. Safe because `/explain` is
  intrinsically read-only.
- **Registered in `schema.ts`** — resolves a latent inconsistency: `explain`
  was already listed in the parity test's `ACTION_SKILLS` (expected to ship as a
  Cursor command) but had no `.cursor/commands/explain.md` entry, so Cursor got
  it through neither rules nor commands.
- **Guard test added** — "a Cursor command for every action skill" now fails
  closed if any action skill (lint/verify/audit/explain/cleanup-zombies/
  self-review/review-spec) lacks a Cursor command. This would have caught the
  original gap.
- **Parity intact** — the existing "Cursor commands ⊇ Claude commands" test
  stays green.

Cursor users now have the same `/explain` lifeline as Claude Code and Codex,
closing the loop the 5XOUDJ offer rule opened.

Ready to mark done.
