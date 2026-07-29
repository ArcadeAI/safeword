## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: 58/58 focused resolver/transport tests pass; the canonical suite under shared load timed out in two unrelated integration tests, both of which pass in isolation
**Gherkin:** ✅ Acceptance lane passes (`bun run test:bdd`: 93 scenarios, 1,109 steps)
**Build:** ✅ Success (`tsup`)
**Lint:** ✅ Clean (`bun run lint`; TypeScript typecheck and Prettier check pass)
**Test Definitions:** All 6 test definitions complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean — no dependency or architecture change in this ticket
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — internal credential-resolution plumbing
**Evidence limits:** ⚠️ The full suite ran under shared-load pressure and hit two unrelated 30-second integration-test timeouts; both passed on isolated rerun. Audit also cannot statically inspect Python imports in the unrelated `experiments/gepa-review-spec/gepa` area because it has no import-linter contracts.

Audit passed with warnings: dependency-cruiser found no violations across 667 modules and 2,178 dependencies; Knip is clean; jscpd reported 514 repository-wide clones (8.92%, primarily template/IDE mirrors and none in the changed files); `bun outdated` reported three unrelated dev-only patch updates.

## Scope Walk

Walked a developer with an existing GitHub CLI login through retro filing fallback; worst step = an invalid credential reaches GitHub and receives its terminal 401; new steps vs before = 0. The changed resolver now rejects malformed subprocess output locally, preserves normal CLI process context, and does not prompt for credentials.
