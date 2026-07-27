# Refactor Ledger

Scope: issue #904 hardening commits rebased onto `63e8bfa23`.

- [x] Reuse `shapeValidImplPlan()` in the two duplicated boundary fixtures.
- [x] Extract the shared committed anchored-advance setup used by amend and rebase scenarios.
- [x] Make ownership scope mandatory on both public detectors and remove the redundant scoped wrappers; format-only mode now omits only the tree reader.
- [x] Centralize configured repository-path normalization in `toRepoDirectory()` (`4dd71218c`, `fcb6d78ce`).
- [x] Require ticket identity and feature roots at the boundary engine seam (`bdcb3cb47`, `6a179bc2b`).

No scout findings were truncated or deferred.
