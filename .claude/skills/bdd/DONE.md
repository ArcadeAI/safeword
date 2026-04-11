# Phase 7: Done Gate

**Entry:** All scenarios marked `[x]` in test-definitions

## Finish

1. **Cross-scenario refactor** if clear wins exist (shared fixtures, duplicate logic, repeated mocks, copy-pasted code). Run full test suite after to verify no regressions. Only refactor if clear wins exist — don't gold-plate.
2. **Run /verify** — tests, build, lint, scenario validation, dependency drift check.
3. **Run /audit** — architecture, dead code, duplication, outdated deps.

If tests are flaky, investigate before proceeding.

**Both `/verify` and `/audit` evidence required** — stop hook validates:

- `✓ X/X tests pass` — proves test suite ran
- `All N scenarios marked complete` — proves scenarios checked
- `Audit passed` — proves /audit ran

## Close

1. Update parent epic if applicable (add completion entry to parent's work log; if all children done → update parent `status: done`)
2. Update ticket: `phase: done`, `status: done`
3. Final commit: `feat(scope): [summary]`
