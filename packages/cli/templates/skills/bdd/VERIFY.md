# Verify: Evidence Gate

**Entry:** All scenarios marked `[x]` in test-definitions.md.

## Steps

1. **Cross-scenario refactor** is done at **implement-exit**, not here — see `TDD.md` → "Implement exit: whole-ticket quality review + refactor" (run `/quality-review` over the whole diff, then `/refactor` the findings, then record the row). By the time you reach verify, the feature-level `- [ ] cross-scenario` row should already carry `<sha>` or `skip: <reason>` for any ticket with ≥2 RGR loops. If it doesn't, go back and complete that step — the done-gate hard-blocks a ≥2-loop ticket whose row is missing or has an empty `skip:` reason.
2. **Run /verify** — tests, build, lint, scenario validation, doc references, dependency drift. /verify writes `verify.md` to the ticket folder on success.
3. **Run /audit** — architecture, dead code, duplication, outdated deps.

If tests are flaky, investigate before proceeding.

## Verify Exit (REQUIRED)

Before proceeding to done:

1. **verify.md exists** in the ticket folder (written by /verify on success)
2. **Update frontmatter:** `phase: done`
3. **Add work log entry:**

   ```
   - {timestamp} Complete: verify - /verify + /audit passed, verify.md written
   ```

The stop hook hard-blocks `phase: done` if verify.md is missing or empty.

**Avoid bloat.**
