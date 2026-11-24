# Verify — superseded-cancelled-check-unblocks-review (QPQ1TQ)

## Verify Checklist

**Test Suite:** ✓ At c323c97f6 (run-number redesign 256385371 + fork attribution 4693c63bc): 104/104 pass across `tests/pr-review` and `tests/lifecycle/origin-main-contract` with the pinned toolchain; CI `test (node 22.23.2)` and `test (node 24.18.1)` pass at c323c97f6; acceptance lane passes under pinned Bun 1.4.4 (local stop-hook failures come from its bare Bun 1.3.14 reading the lockfile). Workflow-identity follow-up (403cedf62): 97/97 pass across `tests/pr-review` and `tests/lifecycle/origin-main-contract`; full suite left to CI on the pushed head. Earlier: CI `test (node 22.23.2)` and `test (node 24.18.1)` pass at b08c21ac5 and eded49d56. Local full run at b08c21ac5: 12058/12075 pass in the package pass; failures are local-only — `hooks/lint-go-context` (local Go toolchain mismatch go1.25.14 vs go1.27.1; CI's Go lint context jobs pass) and `review/execution-plan-contract-identity` (passes 16/16 rerun alone; spawned reviewer CLI under full-suite load). Root pass adds similar review-process timing failures, none in pr-review. Touched files: ✓ 37/37 tests pass in `review-pr-wiring` + `workflow-contract`.
**Gherkin:** ✅ Acceptance lane passes (599 scenarios, 11786 steps)
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint on changed files)
**Typecheck:** ✅ Clean (`tsc --noEmit` in packages/cli at d7bca5fd0)
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions
**Refactor:** ✅ No change warranted — re-scouted at c323c97f6: `currentCheckRuns` is one small single-purpose function and the mirrored worker jq is pinned by the contract test. Earlier /refactor scout at f5d3537a7: test setup already consolidated into `inspectLintRuns` during TDD review; remaining candidates (one-use validation helper, date-parse caching) add abstraction without benefit
**PR Scope:** ✅ Diff matches ticket scope (review-pr.ts, both pr-review-worker workflows and their router callers' `actions: read`, tests, README permission note, regenerated surfaces, ticket)
**Dep Drift:** ✅ Clean (no dependency changes)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — not persona-facing (CI review gating)
**Surface Evidence:** ⏭️ N/A — no affected surfaces in spec; live GitHub workflow behavior unproven until a PR is marked Ready after merge
**Evidence limits:** ⚠️ Full-suite review-process tests are timing-sensitive under local load (pass alone and in CI). Local Go toolchain mismatch fails `lint-go-context`; CI is the authority for that file. Ordering now uses workflow run numbers, so null `started_at` no longer matters.

Audit passed (re-run at c323c97f6: config sync healthy, depcruise --affected clean, eslint and tsc clean, diff limited to the ticket's files; before that at 7795db685: config sync healthy, depcruise --affected clean, diff limited to the ticket's files; earlier full audit on final diff at b42a23fd8) — depcruise clean, config sync healthy, no agent-config/learning/doc drift (README prReview text stays accurate), test quality reviewed (parameterized, behavior-level assertions, failure and pending paths covered).

Cross-agent quality review:

- /quality-review via Codex on c323c97f6 (run-number redesign): review 869cf96e flagged the ticket's stale `started_at` done criteria, reconciled in ticket.md; ac76d541 asked for the publisher validator and current runtime evidence (bundle-evidence.md regenerated for run numbers); final review b3bf0c9c approved, cross-agent, no findings.

- Sonnet subagent (early pass): newest-run rule could hide another workflow's failure — fixed in 3dad6a6e6 with a regression case.
- /quality-review via Codex (gpt-6.1-sol, independence: cross-agent) on the final diff: one error — `generatedCheckPassed` still treated a superseded parity cancellation as failure, forcing generated files to a human. RED 033494611 then fixed in 281baade4 by sharing `currentCheckRuns` between the prerequisite gate and generated-file authorization. Re-review: approve, no findings.
- Advisory PR review on eded49d56 (OpenAI, the repo's configured reviewer): one consequential finding — a later success from another workflow could hide a same-named cancellation. Maintainer approved adding `actions: read`. RED c102b1c00/224690f66, fixed in d7bca5fd0 (workers map each check run's suite to its workflow via `actions/runs?head_sha`; supersession requires the same workflow). Projection checked against live check runs on this PR.
- /quality-review via Codex (cross-agent) on d7bca5fd0: error — the router callers withheld `actions: read`, which a reusable workflow cannot raise. RED 6f2828e0e (general caller-grants-worker-permissions wiring test), fixed in 403cedf62. Re-review on 403cedf62 raised nothing in this change; its two remaining findings predate this PR (installed worker lacks the file-count completeness guard; scheduled discovery ignores `Run state`) and are proposed as separate tasks.
- GitHub REST docs (fetched this session): `started_at` is nullable, so the no-start-time fallback is required; `filter=latest` dedupe scope is undocumented.

TDD review (f5d3537a7): RED confirmed before fix; added proofs for missing start time, malformed start time, and both workers' jq projection (mutation-checked: fails on the old template; the narrowed-rule case fails under 43767ffb5).
