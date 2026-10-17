# Timeout prerequisite verification

## Current state before the prerequisite push

The source change is reviewed. Final focused recheck is queued behind another
worktree's full Vitest run. Normal ticket closure and fresh exact-head CI are
pending. The PR remains Draft; admin merge has not been attempted.

## Terminal local Verify

The packaged Verify block ran unchanged as one Bash invocation through
`scripts/dev`, and exited 1. This is not a blanket passing Verify claim.

- First CLI pass: 679 files, 11213 passed / 14 failed / 12 skipped.
- Scheduled second CLI pass: 679 files, 11226 passed / 1 failed / 12 skipped.
  All 13 failures in unchanged files from the first pass cleared in the second.
  They involved hook/process timing and review-worker inspection under load;
  no assertion or deadline in those files was edited.
- Both passes evaluated the old root BDD script assertion before its correction.
  The corrected assertion requires both prerequisite builds in `pretest:bdd`
  and the explicit CLI delegation in `test:bdd`. Final recheck is queued.
- BDD: 596 scenarios / 11118 steps passed, 11m 52.41s. This full Verify invocation
  inherited the host environment and overlapped another worktree's full tests;
  it is not proof that the 480-second Stop budget is sufficient. The actual
  completion retry, whose runner strips hook identity, must still pass.
- The following proof-manifest command exited 75 without starting a test because
  the shared package lock was held by worktree `ab73`. The focused recheck also
  initially exited 75 for that reason. No lock was removed and no second Vitest
  process was forced. Its queued retry uses the supported
  `SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000` queue-wait option; suite timeouts and
  completion budgets remain unchanged.
- Resolved builds and typed lanes completed. ESLint, Gherkin lint and CLI types
  passed separately. Generated surfaces and all 276 pairs / 11 contracts pass.
- Dependency policy audit passes using the exact CI command and existing ignore
  list. The broad JavaScript scan still has 8 advisories; Python audit is clean.
  Go reports no vulnerable calls, with imported/required-module findings still
  disclosed by the raw scan. No dependency, lockfile or audit-policy change.
- Architecture check: 453 modules / 1620 dependencies, zero errors and the five
  existing orphan warnings. The four original production repair modules,
  semantic fixtures and scenario sources remain unchanged.

## Reviewed proof and raw evidence

Original prerequisite TDD: 4 expected RED failures / 14 passes, then 120 focused
CLI passes. Both added prerequisite-build failure cases passed in the separate
3-case delegation run. These are development results, not final closure proof.

Independent reviews a72189b4 (runner/config/tests) and fc395dcf (ticket and updated
lifecycle assertion) approved with no errors; both used Claude Opus reviewing
Codex, cross-agent. Their warning responses are retained in the adjacent review
response files. The normal helper recorded the done-phase review stamp.

Raw logs and source fingerprints are retained under
`evidence/timeout-prerequisite/`. The source-sha256 manifest identifies the frozen
prerequisite files; CI must additionally verify the final committed head.

The earlier full CLI/BDD/live evidence in verify.md and delivery-final.md is
historical evidence for the original proof-command slice. Neither those passing
runs nor these independent approvals override a failed or unfinished current
completion gate.
