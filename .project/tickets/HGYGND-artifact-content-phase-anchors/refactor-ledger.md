# Refactor Ledger

Scope: issue #904 hardening commits rebased onto `63e8bfa23`.

- [x] Reuse `shapeValidImplPlan()` in the two duplicated boundary fixtures.
- [x] Extract the shared committed anchored-advance setup used by amend and rebase scenarios.
- [x] Make ownership scope mandatory on both public detectors and remove the redundant scoped wrappers; format-only mode now omits only the tree reader.
- [x] Centralize configured repository-path normalization in `toRepoDirectory()` (`4dd71218c`, `fcb6d78ce`).
- [x] Require ticket identity and feature roots at the boundary engine seam (`bdcb3cb47`, `6a179bc2b`).
- [x] Replace the remaining acceptance-runner workspace-root literal with the dependency-free production constant (`4b00163e4`).
- [x] Replace the phase-anchor and boundary-engine unit-fixture workspace-root literals with the same production constant (`437d9844d`, `7390c5441`).

No scout findings were truncated or deferred.

## Quality-review remediation

- [x] Restore `.project`-over-`.safeword-project` precedence from the staged index at commit boundaries and `HEAD` at push boundaries (`af26407e6`).
- [x] Cover both authoritative-root precedence and legacy-only fallback with real commit/push CLI repositories (`af26407e6`, `9dfa14b2c`).
- [x] Strengthen unit ownership assertions to identify the exact `outside this ticket` branch (`7fb4d23ae`).
