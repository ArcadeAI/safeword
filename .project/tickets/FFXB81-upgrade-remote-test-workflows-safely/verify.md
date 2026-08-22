# Verification: Upgrade remote-test workflows safely

## Verify Checklist

**Test Suite:** ❌ 1 integration wrapper remains red because the repository-wide Cucumber lane includes undefined scenarios in separate unfinished remote-testing tickets; FFXB81's documentation, proof-contract, and lifecycle suites pass 94/94 tests
**Gherkin:** ❌ Failed — FFXB81 is correctly excluded as `@proof.vitest`, but other collected features still contain undefined scenarios
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 12 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** HWZZJ8 (siblings: 0/1 done)
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — not persona-facing
**Surface Evidence:** ✅ 1/1 affected surfaces have recorded proof
**Evidence limits:** ⚠️ Branch-wide acceptance evidence is incomplete until the separate unfinished remote-testing features have executable proof or are explicitly assigned to their existing Vitest evidence

Audit passed for FFXB81 with no ticket-specific errors or warnings; the repository audit also reported pre-existing principle-trace findings in other active tickets.

## Surface Evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Safeword CLI | `bun run test tests/bdd-proof-tags.test.ts tests/cli-protocol/cli-documentation-contract.test.ts tests/test-execution/remote-workflow-lifecycle.test.ts` from `packages/cli` | ✅ 94/94 pass |

## Agent's next actions

- Complete or truthfully assign executable proof for the separate remote-testing features still collected by Cucumber, then rerun the authoritative verification block.
