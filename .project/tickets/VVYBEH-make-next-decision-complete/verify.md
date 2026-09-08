# Verification: Make Next decision-complete for users

## Verify Checklist

**Test Suite:** ✓ 156/156 focused tests pass
**Release Parity:** ✅ 8/8 tests pass
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** N/A — copy-contract task with focused regression tests
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ Canonical and dogfood copies match; generated Claude and Codex variants retain the same rule
**Experience:** ✅ No new workflow step
**Surface Evidence:** ✅ 4/4 affected distributions have recorded proof
**Evidence limits:** ⚠️ The full package suite was attempted but could not provide useful aggregate evidence in this restricted host; unrelated process-spawning, port, dependency-bootstrap, and integration timeout failures dominated the run. It was stopped after repeated 60–120 second environmental timeouts. Focused affected tests are green.

Audit passed — the diff-scoped audit found 0 in-scope errors and 0 in-scope warnings.

## Evidence

- Decision-brief contracts: 156/156 tests passed across `quality.test.ts`, `reply-format-contract.test.ts`, and `quality-rubric-generation.test.ts`.
- Release parity: 8/8 `codex-plugin-version.release.test.ts` tests passed.
- Static checks: ESLint, Gherkin lint, TypeScript, Prettier, build, and `git diff --check` passed.
- Architecture: dependency-cruiser reported no violations for the changed graph.

## Experience walk

Read the final `Next` paragraph as a user without prior conversation. Decision cases contain the choice, recommendation, controlling reason, material tradeoff, consequences, and exact reply; no-decision cases reduce to the next action and essential reason. Worst step = none added; new steps vs before = 0.

## Surface evidence

| Affected distribution | Proof | Result |
| --- | --- | --- |
| Canonical templates | Focused contract assertions inspect the generated decision brief | Pass |
| Dogfood install | Canonical and `.safeword` handbook and hook files compare byte-for-byte | Pass |
| Claude plugin | Generated plugin resource/runtime contain the contract | Pass |
| Codex plugin | Generated templates contain the contract; release parity passes | Pass |
