# Verification evidence

This is bounded Draft-delivery evidence, not completion of #4200 or a full
repository verification certification. No merge or Ready promotion is authorized.

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: broader run deferred to Draft CI to avoid overlapping another worktree's Vitest; targeted GREEN was 150 passed, 2 skipped before test-only lint cleanup.
**Gherkin:** ⏭️ Skipped — broader acceptance remains pending; Gherkin lint passed.
**Build:** ✅ Success — all three packages.
**Lint:** ✅ Clean — repository lint passed after the test expression style correction.
**Typecheck:** ✅ Clean — CLI tsc passed.
**Scenarios:** ⏭️ Skipped — task uses inline regression tests, no new BDD scenarios.
**Refactor:** ✅ No change warranted — preserve existing owners for this bounded repair.
**PR Scope:** ✅ Diff matches ticket scope — three production files, three test files, required generated carriers, and scoped evidence only.
**Dep Drift:** ✅ Clean — no dependency or manifest changes.
**Parent Epic:** N/A — follow-up references #4200 without claiming parent completion.
**Reconcile:** ✅ No pattern deviation — existing validation/parser/runtime owners retained.
**Experience:** ⏭️ N/A — internal parsing and review diagnostics; no persona walkthrough claimed.
**Surface Evidence:** ⚠️ Parser and subprocess boundary proven; full public CLI and installed-host walkthroughs unproven.
**Evidence limits:** ⚠️ Full local suite, broader acceptance, exact final test text, full CLI journey, and CI remain unproven at Draft creation.

## Automated and manual results

- TDD RED: 3 files failed; 48 failed, 102 passed, 2 existing platform skips.
  The failures include new behavior and additive reason assertions on existing
  rejection cases. See evidence/red.log.gz.
- TDD GREEN: the same 3 files passed; 150 passed, 2 skipped. Command:
  `scripts/dev bun run --cwd packages/cli test tests/review/execution-plan-output.test.ts tests/execution-plan/delivery-checklist.test.ts tests/review/runtime.test.ts`.
  See evidence/green.log.gz. After that run, test-only lint cleanup replaced a
  computed expected-field string with the equivalent literal field in each
  case. The final test text awaits CI; production behavior did not change.
- `scripts/dev bun run lint`: passed ESLint, Gherkin lint, CLI typecheck.
- `scripts/dev bun run build`: all three packages passed. See evidence/build.log.gz.
- Prettier check on all six changed source/test files: passed.
- `scripts/dev bun scripts/parity-check.ts`: 276 pairs and 11 contracts in sync.
- Generated surfaces: regenerated in prescribed order and independently checked;
  all five current, no lifecycle result changes. Only the two plugin runtime
  bundles and Claude inventory/identity digests changed.
- `scripts/dev bun run deps:validate`: zero errors, five existing orphan warnings.
- Manual source-boundary probe: real Markdown JSON -> parsed delivery contract
  -> trusted definition/digest validator -> real Node subprocess preserved
  repeated flags, empty/whitespace operands, JSON backslash and pipe. See
  evidence/manual-demo.log. This is not a full public CLI journey.
- Independent review: Claude Opus, cross-agent, approved bounded source with
  warnings; signed receipt freshness rechecked. Review id:
  `0c54b154-5c59-4cfe-bbbe-bf49fe532d11`. Raw earlier stale and request_changes
  results are retained; review-scope.md and review-responses.md answer findings.
- Fresh self-review: inspected all source/test changes and corresponding
  generated carriers; no unrelated code changes or old branch merges.

## Incomplete and deferred evidence

The full local suite was queued while another worktree's Vitest process ran.
The wait was cancelled before this suite started; no full-suite result exists
for this branch. Broader current-head checks are delegated to requested Draft
PR CI and remain pending at creation. No new broad acceptance aggregate, live
reviewer qualification, or full public CLI journey is claimed.

The first targeted lint attempt found a test expected-field expression style
error; it was corrected before repository lint passed. The first fresh review
raised existing currency/write-path defects, which are retained and explicitly
deferred outside the requested repair. Non-pipe backslashes in other table
cells now remain literal and can invalidate old retained approval definitions;
those plans must be reviewed again rather than silently carrying approval.

Historical #4200 failed, unfinished, and deferred evidence is unchanged. The
task scaffold remains in_progress; canonical ticket edits were refused by the
host hook, as described in task-spec.md. Verify invocation logging succeeded.

**Next:** push the requested Draft PR, inspect current-head CI, and retain Draft.
