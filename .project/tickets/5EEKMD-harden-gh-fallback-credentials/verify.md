## Verify Checklist

**Test Suite:** ✓ 53/53 focused resolver/transport tests pass; canonical `bun run test` completed
**Gherkin:** ✅ Acceptance lane passes (`bun run test:bdd`)
**Build:** ✅ Success (`tsup`)
**Lint:** ✅ Clean (`bun run lint`; Prettier applied only to the edited test file)
**Scenarios:** All 4 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean — no dependency or architecture change in this ticket
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — internal credential-resolution plumbing
**Evidence limits:** ⚠️ Audit cannot statically inspect Python imports in the unrelated `experiments/gepa-review-spec/gepa` area because it has no import-linter contracts

Audit passed with warnings: dependency-cruiser found no violations across 670 modules and 2,188 dependencies; Knip is clean; jscpd reported the existing repository baseline of 509 clones (mostly generated/template mirrors); `bun outdated` reported three unrelated dev-only patch updates.

## Scope Walk

Walked a developer with an existing GitHub CLI login through retro filing fallback; worst step = an invalid credential reaches GitHub and receives its terminal 401; new steps vs before = 0. The changed resolver now rejects malformed subprocess output locally, preserves normal CLI process context, and does not prompt for credentials.
