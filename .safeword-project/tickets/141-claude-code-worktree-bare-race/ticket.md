---
id: 141
type: task
phase: implement
status: in_progress
created: 2026-05-04T15:35:00Z
last_modified: 2026-05-04T15:35:00Z
---

# File upstream Claude Code bug: parallel-worktree creation flips parent core.bare=true

**Goal:** Get Anthropic to fix a race in Claude Code's worktree creation that breaks git ops across all sibling worktrees.

**Why:** Caught in real time during ticket #130's verify pass. We shipped a defensive workaround in `.husky/pre-commit` (commit `aeb342b`, v0.30.0), but the root cause lives in Claude Code itself — only Anthropic can fix it. Filing the issue gets it on their radar.

## The bug

When Claude Code creates a worktree (e.g., via `mcp__ccd_session__spawn_task`), it momentarily flips the parent repo's `.git/config` `core.bare` to `true`. If another process (a commit, `git status`, husky hook, IDE) catches the parent mid-write, `core.bare = true` stays set, and every git op in any sibling worktree fails with:

```text
fatal: this operation must be run in a work tree
```

## Evidence (caught the race in real time)

In safeword (`https://github.com/ArcadeAI/safeword`):

1. Initial commits in the session worked normally (`e16475b` and prior)
2. After spawning a follow-up chip, subsequent `git commit` calls failed with "not a work tree"
3. Inspected `/Users/alex/projects/safeword/.git/config` — `bare = true`
4. `git -C <repo> config core.bare false` immediately restored functionality
5. Within minutes, `core.bare` flipped back to `true` while another worktree was being created
6. **Timestamp-correlated `.git/refs/heads/claude/<ticket-name>` ref-bump events with the bare-flip events:**
   - `ticket-137-138-unified-override` ref bumped 2026-05-03 10:37:31 ↔ first failed commit at 10:37
   - `ticket-139-harden-overrides` ref bumped 2026-05-03 12:02:10 ↔ second `bare = true` caught during investigation

## Fix request (any of)

- Don't toggle `core.bare` at all during worktree creation (prefer `git worktree add --no-checkout` + post-fixup)
- If toggling is required, hold a flock/file-lock on `.git/config` so concurrent reads don't see the inconsistent intermediate state
- At minimum, document the race in Claude Code's worktree/spawn-task docs so users can add defensive `core.bare = false` resets

## Workaround already shipped in safeword

`.husky/pre-commit` (commit `aeb342b`, v0.30.0):

```bash
GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2> /dev/null)
[ -n "$GIT_COMMON_DIR" ] && git config -f "$GIT_COMMON_DIR/config" core.bare false 2> /dev/null
```

Catches the race inside `git commit`. Ad-hoc `git status` calls still hit it.

## Acceptance Criteria

- [ ] Verify no existing report: `gh search issues --repo anthropics/claude-code "core.bare" "worktree"`
- [ ] If new, file via `gh issue create --repo anthropics/claude-code` with the evidence above
- [ ] Suggested title: `Parallel worktree creation flips parent core.bare=true, breaking git ops in unrelated worktrees`
- [ ] Append the issue URL to ticket #130's work log for traceability

## Work Log

- 2026-05-04T15:35:00Z Created: spawned from ticket #130's verify pass; ~10 min GitHub-issue task.
