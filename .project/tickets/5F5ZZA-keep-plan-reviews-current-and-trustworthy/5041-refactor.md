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
2. [x] Lift the bundle identity normalization helper into a named file-local
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

Item 2: the full Codex plugin version file passed, 19/19 tests. The helper body
was moved verbatim apart from indentation and its explicit return type. It has
no captured test-local state; path/hash verification still precedes masking and
the caller compares all remaining runtime bytes. Cleanup and environment setup
are unchanged. Targeted ESLint and `git diff --check` passed. Neither refactor
needed characterization additions: the existing tests execute these real
generation/bundle boundaries. No failed refactor attempts or unresolved ledger
items remain.

## Evidence boundaries

CI at the starting head passed both Node lanes, lint, parity, CLI contract,
OpenCode conformance, and its dependency audit. This does not erase the earlier
local root relay failures or the eight local Bun audit advisories in `verify.md`.
Parent acceptance, live qualification contradictions and deferrals remain open;
no unchanged paid qualification is authorized by this refactor. PR #5957 stays
Draft; no merge or promotion.

## Post-refactor audit and quality review

Audit ran before quality review, scoped against starting head efaf6ab42: zero
dependency violations (2 test modules / 0 dependencies), healthy config drift,
no changed agent configs or learnings, and no principle/domain trace failures.
Manual test review found no dropped assertion, new mock, mutable shared fixture,
cleanup asymmetry or weakened oracle. Configured README and website docs have
no affected product claim; the architecture inventory is unchanged. This is a
stacked test-only audit, not another whole-branch/repository audit.

Independent quality review `fe34bd12-c6d2-406b-b095-e777a00c53ba` returned
**APPROVE**, actual reviewer Claude, model `opus`, `cross-agent` independence,
zero errors/warnings and three informational findings. Responses:

- Helper assertions are valid inside the calling test; keep the helper
  file-local (already true, with no exports).
- The supported-direction replacement writes identical text, as before. The
  changed Purpose is the discriminating generation probe; separate invalid-mode
  rows reject other directions. No new invalidation-mutation claim is made.
- Static strings/objects deliberately fail closed on template/computed forms;
  duplicate-property last-wins behavior remains unchanged.

Currency: checked the official Vitest test API and Microsoft TypeScript compiler
API documentation linked in `5041-refactor-review.md`, fetched this session on
2026-10-19 (host-provided date). No dependency/API upgrade or new compatibility
claim. Correct/elegant/no-bloat: approved for this bounded structure change.
Wiring: no new production entry point; existing generation, native dispatch and
delivered-bundle tests retain their real collaborators and independent oracle.
These tests do not prove NTB/TBU experience or native UI execution; prior skips
remain. **Next:** retain the successful final checks and push the Draft PR.
