# Phase 7: Verify

**Entry:** All scenarios marked `[x]` in test-definitions.md.

## Steps

1. **Cross-scenario refactor** if clear wins exist (shared fixtures, duplicate logic). Run full test suite after. Only refactor if clear wins exist — don't gold-plate.
2. **Run /verify** — tests, build, lint, scenario validation, doc references, dependency drift. /verify writes `verify.md` to the ticket folder on success.
3. **Run /audit** — architecture, dead code, duplication, outdated deps.

If tests are flaky, investigate before proceeding.

## Phase 7 Exit (REQUIRED)

Before proceeding to Phase 8 (done):

1. **verify.md exists** in the ticket folder (written by /verify on success)
2. **Update frontmatter:** `phase: done`
3. **Add work log entry:**

   ```
   - {timestamp} Complete: Phase 7 - /verify + /audit passed, verify.md written
   ```

The stop hook hard-blocks `phase: done` if verify.md is missing or empty.
