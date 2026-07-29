# Test Definitions: Architecture Fingerprint Provenance

User story:
`planning/user-stories/1615-architecture-fingerprint-provenance.md`

The highest practical scope is CLI integration testing because the contract
crosses the real git index, architecture extractor, document renderer, and CLI
staging behavior.

## Commit-Time Staged-Tree Generation

### Untracked descendant source does not contaminate the staged fingerprint

- Arrange a committed project whose rendered module list contains `renderer`.
- Add an untracked file below `src/renderer/` without staging it.
- Run `safeword architecture --stage`.
- Assert that the staged document matches generation from the committed tree,
  even though normal worktree generation produces a different fingerprint.

### Staged structural source changes update the staged document

- Arrange a committed project and stage a new top-level source module.
- Run `safeword architecture --stage`.
- Assert that the staged document contains the new module and its staged-tree
  fingerprint.

### A generated commit passes a clean-checkout freshness check

- Arrange staged structural source changes and run
  `safeword architecture --stage`.
- Commit the index and check the commit out into a separate clean worktree.
- Run `safeword architecture --check` there.
- Assert that the check exits successfully.

## Explicit Staged-Tree Generation

### `--staged` ignores unstaged source without modifying the index

- Arrange a committed project with different staged and unstaged source shape.
- Run `safeword architecture --staged`.
- Assert that the worktree document reflects the staged tree.
- Assert that the generated document was not automatically added to the index.

### `--staged` restores an unchanged staged document over worktree drift

- Arrange a committed current architecture document.
- Change only unstaged source and regenerate the worktree document normally.
- Run `safeword architecture --staged`.
- Assert that the worktree document is restored to the staged-tree fingerprint.
- Assert that the document was not automatically added to the index.

## Staged-Tree Boundary Cases

### Skip-worktree entries remain architecture inputs

- Arrange a committed project with multiple source modules.
- Mark one tracked module as skip-worktree and remove its worktree directory.
- Run `safeword architecture --stage`.
- Assert that the staged document fingerprint still represents the full index.

### An external absolute project root is rejected before generation

- Stage a Safeword configuration whose absolute `projectRoot` is outside the
  repository.
- Run `safeword architecture --stage`.
- Assert that the command exits successfully without auto-staging, per the
  non-blocking hook contract.
- Assert that no architecture document was written to the external directory.

### A tracked project-root symlink cannot escape the snapshot

- Track a repository-contained symlink whose target is an external directory.
- Stage a configuration selecting that symlink as `projectRoot`.
- Run both `safeword architecture --stage` and
  `safeword architecture --staged`.
- Assert that each mode follows its documented failure exit behavior.
- Assert that neither mode writes any file to the external directory.

### An unstaged worktree symlink cannot redirect materialization

- Keep the staged tree free of a generated architecture document.
- Add either an unstaged namespace-directory symlink or generated-document
  symlink whose target is external.
- Run both `safeword architecture --stage` and
  `safeword architecture --staged`.
- Assert that each mode follows its documented failure exit behavior.
- Assert that neither mode writes any file to the external target.

### A tracked workspace symlink cannot redirect leaf generation

- Stage a monorepo manifest and a workspace symlink whose external target
  contains a package manifest and source module.
- Run both `safeword architecture --stage` and
  `safeword architecture --staged`.
- Assert that all root and leaf write targets are rejected in a preflight before
  generation begins.
- Assert that neither mode creates a leaf architecture document externally.

### A hard-linked destination does not mutate the other directory entry

- Hard-link the worktree's generated-document path to an external sentinel
  file.
- Run both `safeword architecture --stage` and
  `safeword architecture --staged`.
- Assert that generation succeeds by atomically replacing the worktree
  directory entry with a fresh inode.
- Assert that the external sentinel retains its original bytes.
