---
id: E5VDEF
slug: refactor-commit-mixed-worktrees
type: task
phase: intake
status: in_progress
created: 2026-06-24T18:17:30.463Z
last_modified: 2026-06-24T18:20:00.000Z
scope:
  - 'Update the `/refactor` guidance so its one-refactoring -> test -> commit rule handles mixed or detached worktrees without encouraging a commit that bundles unrelated feature work.'
  - 'Teach the skill to inspect git state before the commit step and choose one of three explicit outcomes: commit the isolated refactor files, defer the commit with a reason, or stop and ask when safe isolation is impossible.'
  - 'Add tests or documentation assertions that cover a pre-existing dirty tree, detached HEAD, and a clean branch where the normal commit rule still applies.'
out_of_scope:
  - 'Changing the core one-refactoring-at-a-time discipline.'
  - 'Adding automatic partial staging for arbitrary user changes without an explicit safety check.'
  - 'Changing TDD commit gates or done-gate ledger validation outside the `/refactor` skill surface.'
done_when:
  - 'A refactor in a mixed dirty tree is instructed to avoid creating a mixed feature+refactor commit.'
  - 'A refactor in a detached HEAD worktree has an explicit branch/defer path instead of a blind commit instruction.'
  - 'A clean branch still preserves the existing commit-after-green behavior.'
  - 'The user-facing guidance explains the chosen commit/defer outcome plainly.'
---

# Keep refactor commits scoped in mixed worktrees

**Goal:** Keep `/refactor` from creating mixed commits when the worktree already contains unrelated feature work or is detached.

**Why:** The current skill correctly protects refactoring attribution in a clean branch, but in a mixed or detached worktree the same rule can pressure the agent into bundling unrelated changes just to satisfy "commit after every green test."

## Work Log

- 2026-06-24T18:17:30.463Z Started: Created ticket E5VDEF
- 2026-06-24T18:18:30.000Z Origin: Session rough edge from the PR-scope gate work. `/refactor` asked for "ONE REFACTORING -> TEST -> COMMIT" after a small test-fixture extraction, but the worktree already contained the larger PR-scope feature diff and was detached at the time. A literal refactor commit would have mixed feature and cleanup work, so the agent had to override the skill and explain the deferral manually.
- 2026-06-24T18:20:00.000Z Filed matching GitHub issue: [#407](https://github.com/ArcadeAI/safeword/issues/407).
