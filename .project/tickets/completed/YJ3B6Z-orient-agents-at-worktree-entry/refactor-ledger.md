# Refactor Ledger: Orient agents at worktree entry

- [x] Reviewed duplication: canonical-to-dogfood `SAFEWORD.md` delivery is schema-owned parity, not hand-maintained duplication.
- [x] Reviewed abstraction: the single standing-rule paragraph is the smallest host-neutral mechanism; no extraction or new helper is warranted.
- [x] Reviewed tests: kept the focused direct-file contract and strengthened it to cover session start, `pwd`, repository root, branch, and commit checks.
- [x] Updated the pre-existing Cursor setup integration test to assert the new host-neutral installed behavior instead of the retired Cursor-only phrase.

No behavior-preserving production refactor remained after scouting.
