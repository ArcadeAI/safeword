# User Stories: LOC Gate Clears Below Threshold (Issue #369)

Related issue: https://github.com/ArcadeAI/safeword/issues/369

## Story 1: Recover From Large Diff Cleanup Without Commit

As a developer using Safeword's quality gates,
I want the LOC gate to clear when my current worktree diff drops below the LOC threshold,
so that cleanup actions like stashing or removing unrelated churn do not leave me blocked by stale state.

Acceptance criteria:

- Given a session has armed the LOC gate after a diff at or above `LOC_THRESHOLD`
- When a later PostToolUse pass recalculates the current diff below `LOC_THRESHOLD` without a new commit
- Then the saved quality state no longer has `gate: "loc"`
- And the saved `locSinceCommit` reflects the recalculated below-threshold diff

## Story 2: Ignore Internally Inconsistent LOC Gate State

As a developer recovering from stale or upgraded quality-state files,
I want PreToolUse to deny only when the stored LOC count still meets the LOC threshold,
so that `gate: "loc"` with `locSinceCommit` below threshold cannot produce a nonsense hard block.

Acceptance criteria:

- Given quality state contains `gate: "loc"`
- And `locSinceCommit` is below `LOC_THRESHOLD`
- And `lastCommitHash` still matches the current `HEAD`
- When PreToolUse runs for an edit
- Then it allows the edit instead of denying with a commit reminder
