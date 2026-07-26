# Refactor Ledger

Scope: issue #904 hardening diff from `50abb9bef`.

- [x] Reuse `shapeValidImplPlan()` in the two duplicated boundary fixtures.
- [ ] Extract the shared committed anchored-advance setup used by amend and rebase scenarios.
- [ ] Give enforcing callers a required-scope API while preserving the format-only predicate.
- [x] Centralize configured repository-path normalization in `toRepoDirectory()` (`492b4cd39`, `1186488e3`).
- [x] Require ticket identity and feature roots at the boundary engine seam (`5a3b22d67`, `511ea43be`).

No scout findings were truncated or deferred.
