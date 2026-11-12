# Verification — OpenCode catalogue timeout

Base: main `e49310a749b89cccc73faeeb843273bb05c95f08`.
User explicitly approved this existing-test setup edit on November 11 Pacific.

Only `tests/opencode/catalogue.test.ts` changes: use `offline:true` with a
comment. The real lifecycle installer, isolated filesystem profile, all
catalogue assertions and the existing timeout remain unchanged. No production,
generated, dependency or review-policy change.

**PR Scope:** PASS — one catalogue-test setup flag/comment and bounded task
records. Draft #7190 is published at `f7081a0ea`; no Ready promotion or merge.

## Verify Checklist — November 12 Pacific

Tested implementation head `f7081a0ea583d73bc1d39abab9e2b887fa72e9f1`, based
on main `8daeec44c`. Complete packaged verification
`/tmp/VRJ93G-main-verify-queued.log` exited 0 with the supported longer shared
lock wait. Full lint separately exited 0. Subsequent record edits change no
source, dependencies, assertion or timeout.

**Test Suite:** ✓ 11629/11629 tests pass in each of two full CLI passes; each covers 719 files with 14 skipped. Relay 198 pass / 1 skip; collector 153 pass. Repeated counts overlap and are not added.
**Gherkin:** ✅ Acceptance lane passes: 599 scenarios / 11786 steps, plus 52 BDD proof checks.
**Build:** ✅ Success — all resolved workspace builds, including website.
**Lint:** ✅ Clean — full ESLint, Gherkin lint and changed-file checks pass.
**Typecheck:** ✅ Clean — resolved TypeScript/Python checks pass, website diagnostics clean.
**Scenarios:** ⏭️ Task regression, no new feature ledger; full suite includes the unchanged catalogue/profile assertions. Missing local RED remains missing.
**Refactor:** ✅ No change warranted — setup-only flag/comment; no beneficial structural change in scope.
**PR Scope:** ✅ Diff matches ticket scope — one catalogue setup flag/comment and bounded records against accepted main.
**Dep Drift:** ✅ Clean — Bun audit: none in 1171 packages; uv: none in 39 packages; experimental Python scan clean. Go: zero reachable vulnerabilities, with 1 imported/14 module notices retained. Main's accepted lock/toolchain changes came from #7201.
**Parent Epic:** #4200 remains incomplete; this task grants no original feature or deferred-case credit.
**Reconcile:** ✅ No pattern deviation.
**Experience:** ⏭️ N/A — test setup repair, not a new persona-facing flow.
**Surface Evidence:** ✅ Local lifecycle boundary: all 50 asset bytes verified, errors empty, state changed, no package-manager invocation. Full test/CI coverage recorded; no native OpenCode activation claimed.
**Evidence limits:** ⚠️ Historical CI timeout not reproduced locally; no fresh RED. First post-update verification exited 75 before package tests could start. Earlier failed full runs and every CI attempt remain preserved. These do not alter the observed green subsequent invocation.

CI `43260512508` is successful at the tested head on attempt two. Node 24
passed first attempt. Node 22 passed its CLI suite first attempt (11633 pass /
10 skip) but timed out at 30 seconds in the separate Claude-plugin release
check. Only that failed job was rerun once, unchanged: CLI suite passed again,
all 81 release checks passed, and the same release check took 23.177s. The
timeout remains a real historical failure; no causal claim or timeout change.

Fresh independent cross-agent Claude review `61babf97` approves the entire
catalogue test, with existing assertion-quality warnings preserved below.
Coordinator reports alias `opus`; no exact full model ID or qualification
claim. Configured advisory workflow produced noop and is not counted as
approval. No Ready promotion or merge performed or authorized.

Permanent evidence directory: `safeword-trials/2026-11-08-main-da2778353-csv/epic-followthrough-2026-11-11/opencode-timeout/main-update-2026-11-12/` under `/Users/alex/Projects/`.

## Earlier continuation observations — November 12 Pacific

PR #7201 is now merged on main `8daeec44c`. This branch merged that main
cleanly at `f7081a0ea583d73bc1d39abab9e2b887fa72e9f1`, installed from the
accepted lock with pinned Bun 1.4.4, and pushed the merge to existing Draft
PR #7190. Against current main the scope remains the original test flag/comment
and this task's records. No production behavior or test assertion changed.

Changed-file ESLint, full repository lint/Gherkin lint/typecheck and diff checks
pass. Current-head CI `43260512508` is running; dependency audit, CLI contract,
Dogfood parity, OpenCode conformance and lint pass. Configured advisory review
`43260507582` completed successfully; its substantive feedback still needs
inspection before claiming AI-review approval.

First post-update packaged verification `/tmp/VRJ93G-main-verify.log` exited
75: CLI and BDD proof invocations could not start within the shared lock's
one-minute queue limit. Relay 198 passed / 1 skipped, collector 153 passed,
599 acceptance scenarios / 11,786 steps, builds and typechecks pass. Bun audit
reports no vulnerabilities in 1,171 packages; uv reports none in 39 packages;
the experimental Python scan also passes. Go reports zero reachable
vulnerabilities, retaining 1 imported and 14 module notices. This is not an
all-green invocation, despite the passing non-package lanes.

A fresh complete packaged verification is queued at
`/tmp/VRJ93G-main-verify-queued.log` with the supported
`SAFEWORD_TEST_LOCK_MAX_WAIT_MS=3600000`. This changes only queue admission
wait, not any test timeout. No lock removal or interruption of other worktrees.

Current-head real offline lifecycle probe passes: all 50 catalogue asset bytes
match, state is changed, errors are empty, and no package-manager process is
invoked. Probe elapsed time is 950ms including module startup and verification,
not a CI bound or native-host activation claim. Logs are
`/tmp/VRJ93G-main-offline-probe.{json,log}`.

Fresh cross-agent Claude review `61babf97-a10d-4e58-ab77-ddea67f1c2ab`
approves the integrated head's complete catalogue test file with no errors;
the coordinator reports reviewer model `opus`, not a verified full model ID.
Warnings concern existing generic missing-skill matching, hardcoded agent
expectations and breadth of absent-project-file checks; information concerns
diagnostics and other user-directory isolation. No assertion changes made:
these predate the setup edit and do not block it. The install legitimately
writes project Safeword files, so an empty-project assertion is not the
contract. Deriving every expectation from production data would also reduce
independence; wider assertion design remains outside this bounded repair.
Current advisory workflow `43260507582` produced `kind: noop`, not approval.

Task remains verify/in_progress. No done stamp, Ready promotion or merge.
Missing local RED, every historical failure and all 33 deferred cases remain.

## Historical closure status — before the main update

Exact-head CI `43130744212` passed on its first attempt, including both Node
versions, acceptance/release checks, lint/typecheck and the CI dependency audit.
The code remains unchanged. Full local verification exited 1. Its first CLI
pass failed the unchanged closeout-host-adapter and Codex SessionStart fallback
cases (2 failed / 11,626 passed / 14 skipped). Its next CLI pass passed those
cases but failed the review-route timing case (1 failed / 11,627 passed /
14 skipped): expected `timed_out`, received `probe_timed_out`. Both passes
covered 718 files; their counts overlap and are not added.

All three failed cases then passed unchanged in one isolated diagnostic run:
3 passed, 207 filtered-out cases, 4.28s. This does not erase either failed full
pass or make the aggregate verification invocation green.

**Test Suite:** FAIL — full local passes above; isolated diagnostics pass 3/3 and published CI passes. No clean full-local invocation claimed.
**Gherkin:** PASS — 599 scenarios / 11,786 steps and 52 proof checks pass locally; CI acceptance also passes.
**Build:** PASS — resolved local build lanes and CI builds succeed.
**Lint:** Changed-file ESLint and CI lint pass.
**Typecheck:** PASS — resolved local TypeScript/Python checks and CI typechecks pass.
**Scenarios:** Task regression: 28/28 catalogue/profile checks pass. No new RED or feature-ledger credit claimed.
**Dep Drift:** FAIL — local Bun reports 9 findings (6 moderate, 3 low); uv reports 16 findings in existing locked development dependencies. Experimental Python requirements scan reports none; Go reports zero reachable vulnerabilities, with imported/module notices retained. CI's differently scoped audit passes; no new exemption is inferred.
**Parent Epic:** #4200 remains incomplete; no original obligation or deferred case is ticked off.

- Unchanged baseline: catalogue file passes 5/5 locally, 8.45s.
- Changed candidate: catalogue and profile files pass 28/28, 15.41s combined.
- Direct offline lifecycle probe: all 50 catalogue assets match their expected
  bytes, no npm invocation, 667ms overall. This is a local observation, not a
  CI performance bound or native-host activation proof.
- Changed-file ESLint passes; `git diff --check` passes. Test wrapper builds
  the CLI and declarations successfully.
- Independent cross-agent Claude quality review `21cd5c4d` approves with no
  errors. Its warnings concern existing assertion specificity/self-comparison
  and breadth, not this setup flag. No wider test-hardening work was added.
- Historical main CI `43090952840` failed both Node jobs at 60s in this test;
  its log and job metadata remain preserved. Exact historical subprocess
  timing is unknown; no local timeout reproduction or fabricated RED claimed.

## Historical blocker and continuation — before #7201 merged

Existing Draft PR #7201 separately addresses the inherited JavaScript/Python
audit findings, including certifi, filelock and msgpack, with lockfile and Bun
toolchain changes. Its public report claims clean audits, but it is not merged
and its checks are not this task's proof. Do not duplicate or cherry-pick that
larger change into this catalogue-only patch. Once it lands on main, update this
branch, install from the accepted pins/locks and re-run the closing checks.
If any timing failure persists, diagnose it separately rather than weakening
the catalogue test or claiming an isolated pass settles full-suite reliability.

Limits: verification is recorded but ticket closure is blocked. Ticket remains
at verify/in_progress; no done stamp or closure receipt was created.
PR #7190 stays Draft/unmerged. The unrelated native converter audit failure and all 33 deferred cases
remain unchanged (MCWV4B 18, FC33HK 12, KKP2R3 2, DRD65E 1).
