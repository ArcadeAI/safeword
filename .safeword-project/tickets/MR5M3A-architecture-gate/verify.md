# Verify: Independent evidence-backed architecture gate (MR5M3A)

## Verify Checklist

**Test Suite:** ✓ 148/148 tests pass (all MR5M3A-touched suites: citation, flags, modelsMatch, stamp model tag, author-model capture, review-ledger, impl-plan, the gate integration, the #204 impl-plan-gate regression, schema, config)
**Build:** ✅ Success (tsup)
**Lint:** ✅ Clean (eslint src tests)
**Scenarios:** All 24 scenarios marked complete
**Dep Drift:** ✅ Clean — no new dependencies (pure TS on node builtins + existing safeword libs)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — reuses #204's impl-plan gate shape and the Tier 2 review-ledger verbatim; the cross-model design was corrected to the orchestrator-records-model pattern per Claude Code docs

Audit passed with warnings (architecture clean via depcruise; one non-blocking doc follow-up: record the gate as an ADR in ARCHITECTURE.md).

## Note on the full suite

The full `vitest run` is not tractable in this container: the process-spawning integration tests (`replan`, `typecheck-gate`, and `setup`-based suites) issue `git commit` against the environment's signing server, which returns HTTP 400 and hangs/fails. Those 9 failures are pre-existing and unrelated to this branch (they touch none of the code changed here). The 148 tests above are every suite this ticket created or touched, plus the #204 regression — all green.

## What was built

A default-off architecture review gate (`checkArchitectureReviewGate` in `stop-quality.ts`) that, for a new-flow feature leaving implement, requires:

1. **Cited evidence** in the impl-plan Decisions section (URL or `[n]` marker) — the generation half.
2. **An independent design-review stamp** bound to this ticket's impl-plan at its current content — the selection half (stale-after-edit and cross-ticket stamps rejected).
3. **Cross-model** (opt-in): the review must run on a different model than the author, recorded by the orchestrator (author model captured at SessionStart into `SAFEWORD_AUTHOR_MODEL`); absent tag fails closed.

Default-off behind `architectureReviewGate`, fail-safe on absent/malformed config, tasks and grandfathered features exempt, every requirement carries an auditable `skip:`.

**Next:** mark the ticket done (note: the done-gate's own test run hits the same git-signing hang, so the literal phase:done transition is environment-blocked here — the work itself is complete and verified).
