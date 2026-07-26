# Refactor Ledger

Scope: issue #904 hardening commits rebased onto `63e8bfa23`.

- [x] Reuse `shapeValidImplPlan()` in the two duplicated boundary fixtures.
- [x] Extract the shared committed anchored-advance setup used by amend and rebase scenarios.
- [x] Give enforcing callers a required-scope API while preserving the format-only predicate.
- [x] Centralize configured repository-path normalization in `toRepoDirectory()` (`4dd71218c`, `fcb6d78ce`).
- [x] Require ticket identity and feature roots at the boundary engine seam (`bdcb3cb47`, `6a179bc2b`).

No scout findings were truncated or deferred.
