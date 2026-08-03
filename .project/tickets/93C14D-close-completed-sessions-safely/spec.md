# Spec: Close completed sessions safely

## Intent

Give an agent one dependable way to finish a delivery: prove it is safe to
merge, merge only with the authority granted, preserve the session's learning,
and leave no stale branch or worktree behind.

## Intake Brief

- **Requested by:** Safeword maintainer after repeatedly coordinating verification, merge, retro, and cleanup by hand
- **Cost of inaction:** Agents can report a session finished while CI, review state, retro findings, branches, or worktrees remain unresolved; partial merge failures are especially easy to misread.
- **Reversibility:** Two-way door — the workflow is soft guidance in a skill and can be revised without migrating user data or changing a public API.

## References

- PR #1796 closeout exposed an important partial-success case: GitHub merged the
  PR even though local branch cleanup failed because another worktree had the
  base branch checked out.

## Personas

- Non-Technical Builder (NTB)
- Technical Builder (TBU)

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- Cursor

Unaffected:

- Cloud agent surfaces — closing an ephemeral cloud task has different local
  worktree and session-lifecycle semantics.

## Vocabulary

- **Closeout:** The post-implementation workflow that confirms delivery state,
  captures retro findings, and removes the exact completed branch and worktree.
- **Merge authority:** Permission granted by the user's request to perform a
  normal or administrative merge; administrative authority is never inferred.

## Jobs To Be Done

### close-completed-sessions-safely.NTB1 — Know the work is genuinely finished

**Persona:** Non-Technical Builder (NTB)

> When an agent says a delivery is ready, I want one closeout workflow to verify,
> merge, learn, and clean up, so I can trust that nothing important was quietly
> left behind.

#### close-completed-sessions-safely.NTB1.R1 — Completion is reported only from independently observed delivery and cleanup state

#### close-completed-sessions-safely.NTB1.R2 — Retrospective capture is a mandatory prerequisite to destructive cleanup

#### close-completed-sessions-safely.NTB1.R3 — An interrupted closeout resumes from observed state and reports every unresolved item

### close-completed-sessions-safely.TBU1 — Close precisely without losing control

**Persona:** Technical Builder (TBU)

> When implementation is complete, I want closeout to respect repository state
> and my exact merge authority, so I can finish quickly without unsafe guesses or
> destructive cleanup.

#### close-completed-sessions-safely.TBU1.R1 — Merge actions never exceed the authority explicitly granted by the user

#### close-completed-sessions-safely.TBU1.R2 — Cleanup targets only the confirmed merged pull request's exact topic branch and linked worktree

#### close-completed-sessions-safely.TBU1.R3 — Protected, dirty, locked, main, or ambiguous targets are preserved and reported instead of force-removed

#### close-completed-sessions-safely.TBU1.R4 — The same closeout contract is available through every supported local agent runtime

## Rave Moment

skip: table-stakes — trustworthy completion is a baseline promise, not a moment
to manufacture into delight.

## Outcomes

- A user can ask the agent to close out completed work without remembering a
  multi-step checklist.
- Cleanup begins only after the pull request independently reports a merged
  state. Queued, auto-merge-enabled, pending, failed, and unknown states remain
  unresolved even when the merge command itself exits successfully.
- Retro is a mandatory, fail-closed closeout step with no `--no-retro` escape.
  If retro cannot complete, branch and worktree cleanup does not begin and the
  final report names the blocker.
- Before any deletion, the agent binds the pull request to one exact topic
  branch and, when present, one exact linked worktree. It never removes the main
  worktree, guesses from a similar name, force-removes a dirty or locked
  worktree, or deletes an unmerged target.
- A merge that succeeded before a later local failure is reported as merged
  with incomplete cleanup, not as a failed delivery; rerunning closeout safely
  continues from the observed state.
- The workflow ships from one canonical skill contract with generated/runtime
  adapters and parity evidence for Claude Code, OpenAI Codex, and Cursor.
- The final report states verification, merge or queue state, retro result,
  remote branch, local branch, worktree, and every unresolved item.

## Open Questions

None.
