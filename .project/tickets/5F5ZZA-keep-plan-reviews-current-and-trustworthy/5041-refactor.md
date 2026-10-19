# Bounded #5041 refactor

Starting head: `efaf6ab422ed44316fa18c60d00e66843b7af6dc`.
This follow-up changes test structure only. Production behavior, generated
contracts, qualification identities, main's repairs, and #5051 scope stay fixed.

## Scout and ordered ledger

Read-only discovery combined the installed audit code-quality block against
main, direct inspection of planning sources and diagnostic rendering, and a
separate test-maintainability scout. Coverage: the bounded #5041 planning modules,
copy-failure handlers, and the three recently hardened tests; not the repository.
Audit found zero dependency errors and the existing historical-evidence orphan
warning (536 modules / 1003 dependencies). No ledger entries were truncated.

1. [x] Replace the singleton invalidation table with an ordinary named test.
   Keep its purpose mutation, field checks, install check, and fixed direction.
2. [ ] Lift the bundle identity normalization helper into a named file-local
   function. Keep its independent phase/path/hash oracle and fail-closed AST
   checks before masking exactly the initializer; compare all remaining bytes.

Dependencies: neither item depends on the other. Apply in this leaf-first order,
with targeted tests and a separate scoped commit after each green change.

Resolved without edits:

- Native dispatch's approve/drift/missing/restore sequence is a coherent recovery
  journey. Splitting it would lose continuity; setup already has named helpers.
- Explicit refusal preconditions keep the pending-update prerequisite visible.
  Sharing those assertions would hide the evidence they supply.
- Static-object duplicate-key acceptance follows JavaScript's last-wins semantics;
  changing it would add validation behavior rather than refactor.
- Byte/mtime snapshots detect external writes; process synchronization is a new
  mechanism outside this test-structure cleanup.
- Copy-failure rendering is short and its callers retain different result states
  (`action_required` versus worker/start failure). A shared finding factory adds
  indirection without simplifying this bounded follow-up; leave it unchanged.

## Protection and regression checklist

Run the three hardened test files before changes. After each edit run its whole
test file, inspect the diff, and check no assertion/guard, cleanup boundary, or
default changed. Revert a failed refactor immediately before a smaller attempt.
After the ledger resolves, run audit, then independent quality review, followed
by measurable checks appropriate to these test-only changes.

Baseline: all three hardened files passed, 48/48 tests. Item 1: the full
generation test file passed, 23/23 tests. Diff inspection confirms all assertions,
the purpose mutation, fixture cleanup and invalid-mode matrices are unchanged;
only the singleton wrapper/title and local fixed value changed. No guard or
default dropped. No refactor attempt failed.

## Evidence boundaries

CI at the starting head passed both Node lanes, lint, parity, CLI contract,
OpenCode conformance, and its dependency audit. This does not erase the earlier
local root relay failures or the eight local Bun audit advisories in `verify.md`.
Parent acceptance, live qualification contradictions and deferrals remain open;
no unchanged paid qualification is authorized by this refactor. PR #5957 stays
Draft; no merge or promotion.
