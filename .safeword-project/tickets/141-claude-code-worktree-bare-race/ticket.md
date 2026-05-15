---
id: 141
type: task
phase: implement
status: in_progress
created: 2026-05-04T15:35:00Z
last_modified: 2026-05-15T05:55:00Z
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

### 2026-05-15T05:44Z — Second live reproduction (different surface than `git commit`)

Caught the race again, this time on `git status` instead of `git commit`. New evidence that strengthens the upstream filing.

**Context:** 4 active worktrees in `.claude/worktrees/` (`bold-davinci-601241`, `heuristic-bouman-cb6d3c`, `kind-johnson-be334a`, `vigorous-jang-479dd0`). `kind-johnson-be334a` and `vigorous-jang-479dd0` had been actively writing files in the prior 6–11 minutes.

**Sequence:**

1. ~05:05Z — pulled main cleanly in the parent worktree (`git status` worked, `git pull --ff-only` worked)
2. ~05:05Z–05:44Z — `kind-johnson-be334a` and `vigorous-jang-479dd0` continued doing work in their respective worktrees
3. 05:44Z — `git -C /Users/alex/projects/safeword status -sb` in the parent worktree failed with `fatal: this operation must be run in a work tree`
4. `/Users/alex/projects/safeword/.git/config` had `core.bare = true`
5. `git config core.bare false` immediately restored function

**New finding: the husky workaround has a coverage gap.**

The pre-commit hook resets `core.bare = false` inside `git commit`. But this reproduction was triggered by `git status` (an ad-hoc read), not a commit. The workaround never fired. **Any tool/agent reading the parent worktree while a sibling worktree is being created or modified can hit the race and get a misleading "not a work tree" error.**

This matters for:

- `gh` invocations that shell out to git
- IDEs / editors that poll `git status`
- Shell prompts that show git state
- Any non-commit git read

**Strengthened fix-request rationale:** documenting the race or shipping a one-line reset in user docs isn't enough — the proper fix has to either eliminate the toggle (preferred) or hold a lock that ad-hoc reads respect. The husky hook is a partial mitigation that misses most invocations.

**For the upstream issue body, include:**

- Both reproductions (2026-05-03 around `git commit`, 2026-05-15 around `git status`)
- The coverage-gap point about the workaround
- That the misleading error message blames the user's CWD when the real cause is a shared-config race
