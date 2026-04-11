---
id: '110'
title: Prevent concurrent agent sessions from overwriting each other's commits
type: task
phase: intake
created: 2026-04-11
---

## Goal

Prevent concurrent Claude Code sessions working on the same repo from silently overwriting each other's commits on main.

## Incident (2026-04-11)

Two agent sessions were working concurrently on the safeword repo:

- **Session A** (this session): Ticket #100 (propose-and-converge) — 8 commits to SAFEWORD.md, DISCOVERY.md, SKILL.md, prompt-questions.ts, and ticket files
- **Session B**: CI fixes and quality hook tweaks — commits to SAFEWORD.md, DISCOVERY.md, stop-quality.ts, hooks.test.ts

Session B branched from main BEFORE Session A's commits, did its work, and pushed to main — displacing Session A's 8 commits. Session A's commits survived in the reflog but were no longer on the branch. Session A had to cherry-pick all 8 commits back, resolving conflicts where both sessions touched the same files.

## Root cause

No mechanism prevents concurrent pushes to main from different sessions. Each session assumes it's the only writer. Git's default fast-forward-only push doesn't help because the second session's branch diverged before the first session's commits.

## Options to explore

1. **Branch-per-session** — Each agent session works on its own branch, merges via PR. Prevents direct conflicts but adds PR overhead.
2. **Pre-push hook** — Check if main has advanced since last pull. If so, pull and rebase before pushing. Claude Code's PreToolUse on Bash could gate `git push`.
3. **Lock file** — `.safeword-project/session-lock` with session ID. Other sessions see the lock and work on a branch instead. Fragile if session crashes without unlocking.
4. **Worktree isolation** — Use Claude Code's `isolation: "worktree"` for agent subagents. Each agent gets its own worktree copy.
5. **Convention** — Document that only one session should push to main at a time. Rely on human coordination.

## What we did

Cherry-picked all 8 commits from the reflog onto current main, resolved conflicts (took our version for design files, kept their version for CI files). Pushed successfully. No work was permanently lost.

## Work Log

- 2026-04-11T22:04Z Created: Incident during concurrent session work
