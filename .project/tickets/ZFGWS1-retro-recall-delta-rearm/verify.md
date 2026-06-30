# Verify: Retro recall — delta re-arm + sonnet + async hook + signature dedupe (ZFGWS1)

## Verify Checklist

**Test Suite:** ✓ 4197/4197 tests pass (5 skipped, 0 failures; 294 files — full `bun run test`)
**Gherkin:** ✅ Acceptance lane passes (23 scenarios / 155 steps; the ZFGWS1 feature is `@manual` — proven by the vitest unit + wiring lane)
**Build:** ✅ Success
**Lint:** ✅ Clean (ESLint + Prettier + `tsc --noEmit`)
**Scenarios:** All 26 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope (retro recall: spec/dimensions/feature/test-defs/impl-plan + retro core/hooks/CLI/config + tests + dogfood settings; no unrelated changes)
**Dep Drift:** ✅ Clean (no new runtime dependencies added)
**Parent Epic:** RV9JT4 (parent ticket — retro-transcript-mining)
**Reconcile:** ✅ No pattern deviation (offset state mirrors the sentinel pattern; `resolveRetroModel` mirrors `readSelfReportConfig`; `asyncHook` mirrors `asyncRewakeHook`)
**Experience:** ⏭️ N/A — not persona-facing (the retro is invisible/out-of-band by design; zero conversation footprint)
**Evidence limits:** ✅ None (full suite ran; git-init preflight succeeded)

## Audit

Audit passed (0 errors).

- **Architecture:** no circular dependencies, no layer violations (depcruise: 211 modules, 610 deps, 0 violations). The retro-trigger↔retro-extract cycle was deliberately avoided by housing `OVERLAP_BYTES`/`windowFor`/`retroChildArgs` in retro-extract.
- **Config drift:** ✅ `safeword sync-config --check` in sync.
- **Dead code:** no ZFGWS1 export is unused. The 5 knip "unused exports" are all pre-existing (schema.ts, labels.ts, upstream-monitor, ticket-index-warnings); the `claude`/`gh` "unused binaries" are spawned subprocesses knip can't see (pre-existing). `searchByTitle` fully removed (no stragglers).
- **Duplication:** 1.30% across retro/hooks (13 clones, in pre-existing hook files; none introduced by this ticket).
- **Outdated deps / docs:** repo-wide warnings unchanged by this ticket; out of scope.

## Done-when criteria (from ticket.md)

- ✅ A back-half-only finding reaches the egress pipeline and is filed (SM1.AC1 end-to-end test: delta fire over a >cap transcript files it; a head-capped fire files nothing).
- ✅ Re-fires open no duplicate for the same signature; a new signature files; dedupe by signature (not title); stable session id reaches the child (SM2.AC1/AC2).
- ✅ The retro Stop hook is registered `async: true` and is non-blocking; not `asyncRewake` (TB1.AC1).
- ✅ Fire N digests the window since fire N-1 (with overlap); the union tiles the session (SM1.AC1 + windowFor units).
- ✅ Two near-simultaneous Stops don't corrupt state (atomic temp-write + rename; torn-read prevention; SM2.AC3).
- ✅ Sonnet default at BOTH model sites, config-overridable; a test covers buildAutoExtractor's model (SM1.AC2).
- ✅ Cadence bounded (additive REARM_GROWTH=200 + MAX_FIRES=20 backstop); fail-open; recursion-guarded; never breaks Stop (TB1.AC2). Scenarios green; /verify + /audit pass.

## Summary

Errors: 0 | Warnings: pre-existing repo-wide only | Passed: all gates

Audit passed. Ready to mark done.

**Next:** push the branch and flip the ticket to `done`.
