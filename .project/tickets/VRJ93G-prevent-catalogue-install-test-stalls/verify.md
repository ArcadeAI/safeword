# Verification — OpenCode catalogue timeout

Base: main `e49310a749b89cccc73faeeb843273bb05c95f08`.
User explicitly approved this existing-test setup edit on November 11 Pacific.

Only `tests/opencode/catalogue.test.ts` changes: use `offline:true` with a
comment. The real lifecycle installer, isolated filesystem profile, all
catalogue assertions and the existing timeout remain unchanged. No production,
generated, dependency or review-policy change.

**PR Scope:** PASS — one catalogue-test setup flag/comment and bounded task
records. Draft #7190 is published at `1c54c4a78`; no Ready promotion or merge.

## Current closure status

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

## Blocking dependency and smallest continuation

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
