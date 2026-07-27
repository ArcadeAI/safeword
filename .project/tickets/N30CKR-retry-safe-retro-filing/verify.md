# Verify: Retry-safe retro relay foundation

Verified 2026-07-26 against the final PR worktree.

## Verify Checklist

**Test Suite:** ✓ 5,498 passed, 5 skipped across 370 CLI test files; 110/110 relay tests passed
**Gherkin:** ✓ 612 scenarios (609 passed, 3 skipped); 19,518 steps (19,514 passed, 4 skipped)
**Build:** ✓ Relay and CLI ESM/DTS builds passed
**Lint:** ✓ ESLint, Gherkin lint, and TypeScript checks passed
**Scenarios:** ✓ Shared absolute deadline, schema migration, durable local/server dead letters, ambiguous-create recovery, real CLI wiring, and fault injection have RED/GREEN/REFACTOR evidence
**PR Scope:** ✓ Changes match the gated end-to-end relay slice; public activation and fallback retirement remain out of scope until readiness evidence passes
**Dep Drift:** ✓ `better-sqlite3` is documented in `ARCHITECTURE.md`; generated dependency plan passed
**Parent Epic:** N/A
**Reconcile:** ✓ No undocumented pattern deviation
**Experience:** ✓ Six fresh local/cloud runtime filesystems carry the same explicitly persisted UUIDv4 request bytes through the real installed CLI path
**Evidence limits:** ✓ None; temporary Git repositories were available

## Quality evidence

- Independent quality review: APPROVE after every identified blocker received a
  focused regression and fix.
- Raw REST marker authority is proved in both directions against a sanitized MCP
  fixture.
- Fault injection covers pre-dispatch token failure, post-create ambiguity,
  post-commit response loss, 5xx ambiguity, contention, and
  restart recovery.
- Reconciliation zero/one/multiple dispositions are durably audited and
  observable; zero and multiple outcomes alert.
- CI runs relay and CLI tests/typechecks; release tests passed 22/22, both builds
  passed, formatting/dependency/architecture gates passed, and the production
  dependency audit reported no vulnerabilities.
- #1479 remains open for readiness evidence, production activation, and fallback
  retirement.
