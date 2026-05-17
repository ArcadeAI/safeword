# Verify — Ticket #151

## Verify Checklist

**Test Suite:** ✓ Pre-push schema gate 521/521 pass; release-gate 7/7 pass; templates/config 18/18 pass
**Build:** ✅ Success (`bun run --cwd packages/cli build` — ESM + DTS)
**Lint:** ✅ Clean (`bun run lint` exit 0)
**Scenarios:** ⏭️ Skipped — task ticket, no scenarios
**Dep Drift:** ⏭️ Skipped — no new deps introduced
**Parent Epic:** N/A
**Audit passed:** ✓ Parity check — 95 pairs in sync (was 94, +1 for new hook)

## Done-When evidence

- [x] **Hook resets `core.bare = false` when invoked with a git command on a parent whose config has `core.bare = true`.** Verified by release-gate test (3 assertions: resets bare=true, idempotent on bare=false, no-op outside git repo) and end-to-end on the real repo (flipped → invoked → reset).
- [x] **Hook is registered in templates settings.json and dogfooded in .claude/settings.json.** `matcher: "Bash"`, `if: "Bash(git *)"` (per Claude Code permission-rule syntax; zero spawn cost on non-git Bash).
- [x] **Release-gate test passes** — 3/3 assertions in `pre-tool-git-bare-fix.release.test.ts`.
- [x] **Pair-parity holds** — `.safeword/hooks/pre-tool-git-bare-fix.sh` matches `packages/cli/templates/hooks/pre-tool-git-bare-fix.sh`; SAFEWORD_SCHEMA tracks both.

## Shipped via PR #105 — merged to main

CI lint + test (node 22) both green. Upstream evidence comment landed on [anthropics/claude-code#58345](https://github.com/anthropics/claude-code/issues/58345#issuecomment-4472776936) (3 reproductions + symptom-surface analysis).

> Ready to mark done.
