# Verification: uninterrupted plugin protection after cleanup

## Results

**PR Scope:** ✅ The M2 commit contains the existing handover scenario, its bindings, and supporting assessment/evidence only. This branch also retains the earlier issue 6004 fix and M1 repair.

- RED: the previous fresh fixture fails the stronger requirement with `the handover must execute real cleanup`.
- GREEN: the repaired scenario passes. The complete native feature passes 63 scenarios and 3,013 steps.
- Root lint, Gherkin validation, and CLI typecheck pass.
- Additional strict step-file compilation reproduces the same 41 baseline primary diagnostics; normal package typechecks exclude this step file. No new primary diagnostic remains.
- Complete acceptance passes 597 scenarios and 11,140 steps. CLI and relay builds pass. The subsequent 51 proof-tag tests did not start: another checkout held the shared package-test lock and the wrapper exited 75 after 60 seconds. No concurrent Vitest run or lock bypass was attempted. Those tests passed in the preceding M1 verification; this repair preserves scenario names and tags.
- No production code, template, generated runtime, or dependency was changed.

Follow-up during M3: `scripts/dev bun run test:bdd:proof` passed all 51 tests
after the other checkout released the lock. This resolves the test-execution
limit above; the earlier exit-75 log remains as observed evidence.

## Discriminating proof

Temporary copies of the final step definitions import the real repository
collaborators and generated plugin. Baseline passes; all five targeted faults fail:

| Fault | Observed failure |
| --- | --- |
| Skip confirmed cleanup while reporting plugin-mode | Legacy registration remains |
| Omit the plugin event after cleanup | No plugin effect file |
| Execute the plugin event twice | Two effects instead of one |
| Send a changed session ID after cleanup | Captured hook input differs from the original session |
| Omit pre-cleanup legacy execution | No actual guard approval response |

These are five targeted fault probes, not a comprehensive mutation score. The
session probe verifies that the test harness sends the same session; PreToolUse
does not enforce session-dependent behavior in production.

The repaired example starts with a registered, catalogue-accepted config guard.
It executes the real dispatcher for SessionStart and validates exact proof for
the version, manifest, canonical cache and project roots, event, and session.
Before cleanup, the real legacy guard requests approval for an ESLint edit and
the plugin produces no duplicate functional effect. Real CLI preview returns
cleanup-ready and a plan; confirmed cleanup returns plugin-mode, removes the
legacy registration, and writes a clean marker. Shared hook source remains by
design. The next PreToolUse uses the same session, cache and plugin-data directory;
it produces exactly one effect. The harness rereads remaining legacy registration
after cleanup and the legacy response count stays at one. No profile mutation,
reload, new SessionStart, or proof replacement occurs.

## Review and limits

Initial independent Claude Opus review approved with warnings, receipt
`1d96e4ff-f7cc-430a-970a-734e69925784`. File-removal wording was corrected;
post-cleanup legacy registration is now reread rather than simply not invoked.
Final independent Claude Opus review approved both changed source files with
cross-agent independence, receipt `0a988f06-3bef-47de-9a02-ab744c25d2fb`.
No blocking findings remain. Its warnings reiterate the instrumented functional
command, simulated session inputs, and fixture-specific registration probe;
these do not establish desktop host lifecycle or full event-group behavior.

The implement-exit stamp was refused because its branch-wide coverage check
includes earlier ticket work beyond this scoped receipt. The ticket remains
in implement/in_progress; no completion stamp was bypassed. Scoped code review
and executable verification are recorded independently of that limitation.

The Claude profile adapter is fake and the dispatcher wraps an instrumented
functional command. This verifies the real dispatcher/cleanup boundary and
same-session inputs; it does not establish desktop host reload or response
merging behavior. M3 and the other assessment findings remain outside this repair.
