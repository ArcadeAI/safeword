# Final local verification for PR 6025

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: another checkout holds the exclusive Vitest lock. Last relevant unit run passed 140 tests with one existing prerelease skip; R1 then passed its 100 affected tests. Fresh integrated full-suite/proof-tag results are required from CI before merge; no fresh local full-suite pass is claimed.
**Gherkin:** ⚠️ Partial-lane pass: both affected Claude feature files pass 104 scenarios and 5,090 steps after integration with main; full integrated acceptance/proof-tag lanes remain pending CI.
**Build:** ✅ Generated plugin bundles rebuilt successfully from the integrated source; all five generated surfaces verified current.
**Lint:** ✅ Root lint and Gherkin validation pass.
**Typecheck:** ✅ Package typecheck passes; extra strict step-file diagnostics remain documented pre-existing debt.
**Scenarios:** ✅ All 104 expanded affected examples pass; no WIP scenario is enabled or skipped by this repair.
**Refactor:** ✅ Completed — abbb238bf and 81dfa82e9; optional diagnostic hash optimization reverted/deferred.
**PR Scope:** ✅ Diff matches the issue 6004 integrity fix and the explicitly requested BDD/TDD quality repairs, audit and refactor; main integration adds no separate feature to this PR diff.
**Dep Drift:** ✅ Clean — existing YAML dependency, no manifest/lockfile upgrade.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — generator, dispatcher and status reuse the semantic helper; exact runtime/template/legacy validation remains.
**Experience:** ✅ No new user steps; normalization keeps the existing generated prompt hook working.
**Surface Evidence:** ✅ Real generated hook entrypoint and CLI/profile collaborators exercised; manual dispatcher walkthrough outside the test runner is recorded in N7QY4E delivery-evidence/walkthrough.json. Authenticated desktop GUI execution is not claimed.
**Evidence limits:** ⚠️ Full integrated CI is pending and blocks PR readiness/merge; local test contention, simulated Claude command adapters, and no new desktop release installation remain explicit.

Audit passed: final diff-scoped architecture/config/learning/domain checks; no dependency violations. Independent Claude Opus reviewed the combined handwritten implementation/tests and approved with no errors (7cbda067-989c-4808-b5c1-9dd42f626463); the only subsequent source edit is its suggested YAML-assumption comment, independently re-reviewed in N7QY4E delivery-evidence/comment-review.json.

The older M1/M2 implement-exit branch-wide stamp could not cover other ticket archives/oversized generated docs. The supported skip records that administrative limitation explicitly, while retaining the actual scoped independent approvals and runtime evidence. No fabricated review or changed gate configuration is used. This local completion evidence does not declare PR readiness; CI must pass at the final head before admin merge.

Traceability: the 140-test audit run is recorded in `.project/tickets/N7QY4E-keep-desktop-plugin-gates-active/audit-refactor-evidence/audit-tests.log.gz` (audit fix commit `3e2f66f6d`). M1 means the legacy-protection repair (`4RGYMY`); M2 means same-session cleanup handover (`117CBF`); R1 means the shared test-header helper (`81dfa82e9`). Exact timestamped skip records are preserved in `.project/tickets/N7QY4E-keep-desktop-plugin-gates-active/delivery-evidence/phase-stamp-skips.log`.

## Historical verification

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
