# Formal verification of residual proof hardening

## Verify Checklist

**Test Suite:** ✓ 173/173 tests pass in the final three-file hardening run; 2,236/2,236 smoke tests pass. The formal resolved plan also passed CLI 11,489 tests with 14 skips in each of two runs, relay 198 with one skip, collector 153 twice, and the Go checker.
**Gherkin:** ✅ Acceptance lane passes: 597 scenarios, 11,140 steps; proof-tag lane 51/51. ❌ The separate root broad-feature dry-run has 172 undefined cases and 516 undefined steps; this is not feature completion.
**Build:** ✅ Success across the resolved build plan, including the website.
**Lint:** ✅ Clean: root ESLint, Gherkin lint and CLI TypeScript check, plus targeted changed-test lint.
**Typecheck:** ✅ Clean: formal resolved typecheck plan (Astro 0 errors and Python 5 source files), plus root lint's CLI tsc.
**Scenarios:** ❌ Current broad feature ledger is 0/165 RGR checkboxes complete across 55 definitions. The earlier 0/159 count came from an undercounted 53-entry ledger; quality review repaired two missing entries and one title without marking any behavior complete. Historical runs and counts remain retained.
**Refactor:** ✅ Completed — cccae7bcc shares the installed fixture; 16/16 protection tests passed before the subsequent hardening. Existing assertions were preserved.
**PR Scope:** ✅ Diff matches ticket scope: #5051 residual admission/disposition, proof hardening, factual contract/copy correction, generated carriers and evidence. No #5086 fallback or runtime canonical/approval changes.
**Dep Drift:** ✅ Clean: package manifests and bun.lock unchanged from main; documented dependency families still cover the implementation. Supply-chain audit is separately failed below.
**Parent Epic:** 82T411 (#4200); historical siblings remain 0/11 done. No epic completion claimed.
**Reconcile:** ✅ No pattern deviation: existing role resolution, canonical identity, authenticated review status, file lock and command catalogue are reused.
**Experience:** ⚠️ No new human walkthrough; deterministic PTY interactions establish confirmation mechanics, not Non-Technical Builder usability or the broad Killer Demo payoff.
**Surface Evidence:** ⚠️ Public CLI/PTY, installed distribution and existing native-boundary regressions have recorded proof. Actual cross-host/cloud/human qualification remains limited and deferred as recorded in the feature evidence.
**Evidence limits:** ⚠️ Formal aggregate exits 1 because the unchanged JavaScript dependency graph reports eight vulnerabilities (2 high, 3 moderate, 3 low). Python audit is clear; Go reports zero called vulnerabilities, with imported/module advisories noted. Root broad scenarios remain undefined. No unchanged paid qualification rerun.

Audit passed with warnings for the bounded diff; broad scenario proof remains
request-changes. See [audit](audit.md) and [finding dispositions](review-dispositions.md).

## Commands and revisions

Base: e7b1f9f9c39da46f954d244d2371aa279ae96c1e (main after #5957).
Production source remains the pushed 10c725b7d revision throughout this pass.
The formal resolved plan began before the test-only hardening; its two complete
CLI runs report 11,489 passing tests each. Do not present those counts as the
new cases' evidence. Final hardening 173/173, smoke 2,236/2,236, lint and static
generated checks ran against the final test/source worktree based on cccae7bcc.
The final commit adds only these verified changes, scenario corrections and
evidence; recorded commands precede that commit, not an invented exact-SHA run.

- `scripts/dev bash /tmp/5051-verify-block-2.sh`: verbatim packaged verify
  execution block, resolving verify/BDD/build/typecheck/deps plans; aggregate 1.
- `scripts/dev bun run test tests/cli-protocol/review-wiring.test.ts tests/integration/planning-review-disposition.test.ts tests/review/scenario-role-selected-parent.test.ts`: 173 passed, exit 0.
- `scripts/dev bun run --cwd packages/cli test:smoke`: 108 files, 2,236 passed, exit 0.
- `scripts/dev bun run lint`: exit 0.
- `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts`: exit 0.
- Root Cucumber dry-run with `NODE_OPTIONS='--import tsx'` and the explicit
  feature path: exit 1, 172 undefined expanded cases. Imported package steps
  account for 7,396 skipped steps; 516 are undefined for this root feature.

The shared build-lock wrapper serialized Vitest. The smoke command waited for
the hardening runner. The earlier 172-pass/1-fail run exposed an incomplete
Execution reviewer fixture, subsequently repaired without production changes.
The wrong root generated-check script name and two dry-run invocation errors
are retained alongside corrected runs. Failed or unstarted checks are not passes.

## Review and delivery state

Fresh Claude/opus cross-agent review
44238cc8-99c4-4410-9706-f97eed5dce21 is approved; signed status rechecked
against the final test files. Earlier scenario request-changes and all contrary
historical qualification observations remain retained. Draft PR #5980 remains
Draft; merge and Ready promotion are not authorized. Current-head CI is checked
and reported in the PR body after push, separately from these local results.
