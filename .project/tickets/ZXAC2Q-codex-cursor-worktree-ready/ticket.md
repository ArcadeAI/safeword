---
id: ZXAC2Q
slug: codex-cursor-worktree-ready
type: task
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/5392
external_prs: [https://github.com/ArcadeAI/safeword/pull/5413]
created: 2026-10-05T06:28:17.604Z
last_modified: 2026-10-05T15:20:00.000Z
---

# Let Codex and Cursor worktree sessions mark a finished PR ready

**Goal:** In a Codex or Cursor session working in a worktree, the Ready guard and readiness receipt use that worktree, as #5382 made them do for Claude Code.

**Why:** The Codex and Cursor adapters drop the host's cwd, so the shared hooks fall back to the launch checkout and refuse gh pr ready (#5392).

## Host payloads

Per current vendor docs (fetched 2026-10-05):

- Codex (<https://learn.chatgpt.com/docs/hooks>): every hook carries `cwd`.
- Cursor (<https://cursor.com/docs/agent/hooks>): `beforeShellExecution` and `preToolUse` carry `cwd`; `postToolUse` does not. `beforeShellExecution` has no per-call id that `postToolUse`'s `tool_use_id` could be matched to.

## Known limitation

The Cursor stash holds only the latest shell command's cwd per conversation. Overlapping shell executions across different worktrees in one conversation could attribute a post-tool observation to the wrong worktree. With no shared per-call id between the two Cursor hooks, this cannot be correlated (review 0fce832f warning).

## Tests

- `packages/cli/tests/integration/pr-readiness-delivery-gate.test.ts` — Codex and Cursor adapters, run from the launch checkout, close a worktree ticket and are allowed `gh pr ready`; an unfinished worktree ticket is still denied. Removing either pass-through turns its host's test red.
- `packages/cli/tests/hooks/cursor-state.test.ts` — the shell cwd stash round-trips and is cleared by a command without cwd.

## Work Log

- 2026-10-05T06:28:17.604Z Started: Created ticket ZXAC2Q
- 2026-10-05T06:40Z RED: Codex and Cursor worktree Ready tests denied with the launch checkout's unfinished ticket. GREEN in 86236d8; mutation of each pass-through re-reds its host's test.
- 2026-10-05T06:55Z Review 0fce832f (Codex): stale stash error fixed test-first in 92cc653; overlap warning recorded above. Review 3876df74 approved.
- 2026-10-05T14:35Z Merged main (87 commits). main's 3fd81e7 already passes Codex cwd through, so the Codex helper conflict resolved to main's version; this PR is now Cursor-only, with the Codex worktree test kept as regression coverage. 134/134 targeted tests pass after the merge (001805925).
- 2026-10-05T15:01:25.474Z Phase: intake → done
