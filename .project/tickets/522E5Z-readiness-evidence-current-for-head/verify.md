## Verify Checklist

**Test Suite:** ✓ 9304/9304 tests pass (567 files, 16 skipped, 0 failed — full local suite after merging main current)
**Gherkin:** ✅ Acceptance lane passes — 1493 scenarios (1490 passed, 3 skipped), 68465 steps
**Build:** ✅ Success
**Lint:** ✅ Clean
**Typecheck:** ✅ Clean — tsc across 3 packages, astro check 0 errors
**Scenarios:** ⏭️ Skipped — no test-definitions.md; this task shipped without BDD scenarios, recorded as a gap rather than a claim
**Refactor:** ✅ Completed — the GitHub response guard was homed in `pr-review/github-request.ts`, taking the pr-review area from four copies of `isRecord` to two; the remaining pair lives in files this change does not touch
**PR Scope:** ✅ Diff matches ticket scope — the F56PR9 lease tests were reverted off this branch (recoverable from 7461ca380, pointer recorded in F56PR9) and a stray experiments Go binary was untracked in 5832adc2d. One deliberate inclusion, accepted in the ticket: the pr-readiness coverage-wording fix, requested in the same turn and editing the same shipped file.
**Dep Drift:** ✅ Clean — no dependency added
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — the ADR clause the status contradicted was narrowed in ARCHITECTURE.md under "Deterministic Readiness Evidence Status", using the repository's existing partial-narrowing idiom
**Experience:** ⏭️ N/A — CI plumbing, not persona-facing
**Surface Evidence:** ⚠️ 1/2 affected surfaces proven — CLI surface proven (`review-pr readiness` registered, contract green, 16 unit tests including a wiring test through the real GitHub boundary with only fetch stubbed, and three mutation-verified assertions). GitHub Actions surface `skip: unprovable before merge` — `pull_request_target` evaluates the workflow from the base branch, so the job does not exist to GitHub until this lands on main; confirmed directly, the runs on this PR contain no readiness job.
**Evidence limits:** ⚠️ The GitHub Actions surface cannot be exercised by the pull request that introduces it (base-branch rule above); its first real execution is the next pull request after merge. The fork-PR `statuses: write` path is documented but not demonstrated — this branch is in-repo. Earlier full-suite runs showed load-sensitive failures in `tests/cli-protocol/review-candidate-share.test.ts` and `tests/review/job.test.ts` that pass in isolation; the final run after merging main was clean.

Audit passed with warnings — Errors: 0 | Warnings: 2 | scope: origin/main diff.

- The E004 ARCHITECTURE conflict raised by the first audit is resolved: ARCHITECTURE.md now records the narrowed constraint, that safeword never modifies branch protection, that it recommends against requiring the context, and the commit-scoped-status limitation.
- [W-preexisting] 9 E010 broken principle traces in other tickets (CKWE2D, 3F5Z6P); none in 522E5Z, which declares no impl-plan.
- [W-surface] GitHub Actions surface unproven before merge, as recorded above.

Checks run clean: config drift (W007) none; depcruise no violations; learnings W006 none changed; domain docs W008/E008/E009 not triggered; dependency audit clean; actionlint clean; parity 264 pairs and 8 contracts in sync.

Independent review: five cross-agent Codex passes, independence intact on every one. Four defects found and fixed — two false passes in the evaluator, a missing wiring test, a CRLF regression I introduced while fixing the first, and a publication race. The fifth pass's finding (two pull requests sharing a head commit contend for one commit-scoped status) is recorded in the ADR as an accepted limitation rather than fixed.
