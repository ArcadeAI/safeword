# Verification: Prevent public CLI contracts from drifting again

## Verify Checklist

**Test Suite:** ✓ 7326/7326 tests pass (6 skipped)
**Gherkin:** ✅ Acceptance lane passes (1,359 passed, 3 skipped; 58,402 steps passed, 4 skipped)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 57 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — internal merge-gate plumbing; no persona-facing step was added
**Surface Evidence:** ✅ 2/2 affected surfaces have recorded proof
**Evidence limits:** ✅ None

Audit passed — diff scope found no errors or warnings; dependency-cruiser reported zero violations across 323 modules and 495 dependencies, and the principle, domain-doc, learning, documentation, and changed-test checks were clean.

## Surface Evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Safeword CLI | `bun run check:cli-contract`; full Vitest; full Cucumber | Contract consistent; 7,159 CLI tests passed; 1,359 runnable scenarios passed |
| GitHub Actions Execution Sandbox | PR #2295 runs 31307192590 and 31307432014; authenticated ruleset 16731324 inspection | Dedicated context observed green in 68 seconds; exact context required with strict-current-main |

## Live Ruleset

- Required checks: `Dogfood parity`, `CLI contract` (GitHub Actions integration 15368).
- Strict required-status-check policy: enabled.
- Ordinary named-user bypass actors: removed.
- Remaining administrative bypass: `OrganizationAdmin`, PR-only. This keeps administrative recovery explicit and auditable without exempting ordinary pull requests.

## Scope and Experience Walk

The final diff implements only issue #2283: production CLI assembly/reconciliation, exhaustive invocation coverage, shipped-output and generated-document freshness, canonical terminology, and staged CI/ruleset enforcement. No retained alias was deleted and Cursor remains opt-in.

Walked the Safeword Maintainer through adding or changing a CLI route; worst step = waiting for the 68-second focused contract check; new steps versus before = 0 locally because the same gate is available as one command and runs automatically in CI.
