# Verify: Evidence Gate

**Entry:** All scenarios marked `[x]` in test-definitions.md, implement-exit
review/refactor is complete, and `impl-plan.md` is reconciled. Entry is
automatic after implementation: run `$safeword:verify`, then `$safeword:audit`, without asking the
user whether to proceed.

## Steps

1. **Cross-scenario refactor** is done at **implement-exit**, not here — see `TDD.md` → "Implement exit: whole-ticket quality review + refactor" (run `$safeword:quality-review` over the whole diff, then `$safeword:refactor` the findings, then record the row). By the time you reach verify, the feature-level `- [ ] cross-scenario` row should already carry `<sha>` or `skip: <reason>` for any ticket with ≥2 RGR loops. If it doesn't, go back and complete that step — the done-gate hard-blocks a ≥2-loop ticket whose row is missing or has an empty `skip:` reason.
2. **Run $safeword:verify** — tests, build, lint, scenario validation, doc references, dependency drift. $safeword:verify writes `verify.md` to the ticket folder on success.
3. **Run $safeword:audit** — architecture, dead code, duplication, outdated deps.

If tests are flaky, investigate before proceeding.

## Verify Exit

Before proceeding to done:

1. **verify.md exists** in the ticket folder (written by $safeword:verify on success)
2. **Update frontmatter:** `phase: done`
3. **Work log:** the phase hook stamps the transition with real time (Claude Code — on other harnesses add a short transition entry yourself); optionally add a narrative entry (what $safeword:verify and $safeword:audit found).

The stop hook hard-blocks `phase: done` if verify.md is missing or empty.

**Avoid bloat.**
