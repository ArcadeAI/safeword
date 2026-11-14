# Timeout prerequisite verification

## Final local completion result

The real source Codex Stop adapter passed in 906.745 seconds with the actual
session identity, matching 2400-second outer allowance, exit 0 and `{}` output.
It automatically changed the canonical ticket from in_progress/done to
done/done at 2026-10-17T16:32:07.139Z. Completion status was not edited by hand.
The adapter ran the resolved fast/native lanes and the complete deduplicated
serial BDD command, including its proof-manifest successor. No scenario filter
or assertion changed. Fresh final-commit CI remains required before promotion
and authorized admin merge; the PR remains Draft until those checks pass.

The insufficient 480-second budget was replaced with 1200 seconds for BDD and
2400 seconds for native completion callbacks. The old 600-second host value was
configurable, not an immutable ceiling. The rejected parallel implementation
was completely reverted. Policy, limitations and primary references are in
timeout-final-budget.md; independent review responses are adjacent.

## Final focused checks and independent review

- Final budget RED: two runner cases and four physical host-manifest cases
  failed before the source and generated policy were corrected.
- GREEN: 198 tests across 8 files passed, including actual native timeout-error
  recognition, delegated builds, conservative resolver behavior, all 50
  proof-manifest tests and existing real OpenCode dispatcher integration.
- The earlier corrected root lifecycle assertion/proof recheck passed 186
  tests after waiting for the shared Vitest lock. It did not bypass that lock.
- Types, formatting, configured scoped lint, all five generated surfaces and
  all 276 parity pairs / 11 contracts passed. Architecture: 453 modules /
  1621 dependencies, zero errors and five existing orphan warnings. This final
  budget worktree adds the OpenCode-to-config import; the earlier 1620-edge
  count below belongs to prerequisite HEAD 95eea075 before that import.
- Configured lint excludes template hooks. An extra forced ESLint probe found
  seven diagnostics; the exact pre-budget HEAD probe found the same seven.
  These are not reported as a passing forced lint run or new budget defects.
- Independent Claude Opus review d2f3caf0-a198-4e29-b5f8-9469007db083 approved
  the final code in a separate headless process. Every warning is answered in
  timeout-budget-review-responses.md. Aggregate workspace deadlines, descendant
  process cleanup and installed-host long-duration journeys remain unproven.
- CI run 39041604751 passed at prerequisite HEAD 95eea075. This is historical
  evidence, not proof for the forthcoming final commit.

## Terminal local Verify

The packaged Verify block ran unchanged as one Bash invocation through
`scripts/dev`, and exited 1. This is not a blanket passing Verify claim.

- First CLI pass: 679 files, 11213 passed / 14 failed / 12 skipped.
- Scheduled second CLI pass: 679 files, 11226 passed / 1 failed / 12 skipped.
  All 13 failures in unchanged files from the first pass cleared in the second.
  They involved hook/process timing and review-worker inspection under load;
  no assertion or deadline in those files was edited.
- The one remaining failure was tests/cucumber-config.test.ts, "keeps the
  package-local BDD lane complete for Cucumber and Vitest-backed features".
  It expected the old combined root script. The corrected pretest/delegation
  expectation passed in the 186-test recheck and final 198-test group.
- Both passes evaluated the old root BDD script assertion before its correction.
  The corrected assertion requires both prerequisite builds in `pretest:bdd`
  and the explicit CLI delegation in `test:bdd`. Its final recheck passed.
- BDD: 596 scenarios / 11118 steps passed, 11m 52.41s. This full Verify invocation
  inherited the host environment and overlapped another worktree's full tests;
  it did not prove that the 480-second Stop budget was sufficient. The final
  completion retry above passed with the corrected budget and stripped child
  hook identity.
- The following proof-manifest command exited 75 without starting a test because
  the shared package lock was held by worktree `ab73`. The focused recheck also
  initially exited 75 for that reason. No lock was removed and no second Vitest
  process was forced. Its queued retry used the supported
  `SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000` queue-wait option; suite timeouts and
  execution budgets were unchanged for that recheck. It passed all 186 tests,
  including all 50 proof-manifest tests. The final 198-test group and successful
  adapter execution independently covered the proof-manifest successor again.
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
