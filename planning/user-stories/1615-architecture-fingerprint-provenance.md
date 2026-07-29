# Architecture Fingerprint Provenance

GitHub issue: [#1615](https://github.com/ArcadeAI/safeword/issues/1615)

## Story

As a developer committing a structural source change, I want Safeword's
commit-time architecture snapshot to reflect exactly the staged tree, so the
generated document remains fresh when the commit is checked out elsewhere.

## Acceptance Criteria

### Unstaged source is excluded from commit snapshots

Given a clean repository with an existing top-level source module, and an
untracked descendant source file that does not change the rendered module list,
when `safeword architecture --stage` runs, then the staged architecture
fingerprint is derived without that untracked file.

### Staged structural changes are included

Given a clean repository with a staged structural source change, when
`safeword architecture --stage` runs, then the staged architecture document
reflects the staged structure and carries its fingerprint.

### Committed snapshots are reproducible

Given a commit produced after `safeword architecture --stage`, when that commit
is checked out in a clean worktree and `safeword architecture --check` runs,
then the check succeeds.

### Developers can explicitly use the staged tree

Given staged and unstaged architecture inputs differ, when a developer runs
`safeword architecture --staged`, then Safeword generates from the staged tree
without automatically adding the document to the index.

### Sparse checkouts retain the full staged shape

Given tracked staged entries carry Git's skip-worktree bit, when
`safeword architecture --stage` runs, then the generated document still
reflects those entries because they remain part of the staged tree.

### Staged generation cannot escape the repository

Given a staged configuration contains an absolute project root outside the
repository, when staged-tree generation runs, then Safeword does not write to
that external location. The same boundary holds when a repository-contained
project-root path is a tracked symlink to an external directory, or an unstaged
worktree destination redirects the generated document through a symlink.
Tracked monorepo workspace symlinks cannot redirect leaf-document generation
outside the staged-tree snapshot either, and replacing a worktree document does
not mutate another path that shares its inode through a hard link.

## Out of Scope

- Changing the worktree provenance of the default `safeword architecture`
  command.
- Generating architecture documents from arbitrary git references.
- Changing which paths or manifest fields are architecture inputs.
