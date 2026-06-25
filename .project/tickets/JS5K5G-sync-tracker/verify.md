# Verify: JS5K5G — safeword sync-tracker (one-way projection v1)

## Verify Checklist

**Test Suite:** ✓ 3292/3293 tests pass (5 pre-existing skips; 222 files) — includes JS5K5G's 61 new tracker-sync unit tests. The single non-pass is `cucumber-bdd.test.ts > …dogfood_feature_runs_green`, a **pre-existing flaky** (a `codify` dogfood assertion sensitive to parallel-run ordering) — it passes 2/2 in isolation and the prior full run this session was clean; JS5K5G touches no `features/`/`codify` code.
**Gherkin:** ❌ Failed — but **pre-existing and unrelated**: features merged from main (`pm-grade-intake-readiness-gate.feature` and others) carry no step defs and no `@wip` → undefined scenarios (filed as #341). JS5K5G's `features/sync-tracker.feature` is `@wip`-excluded (proof lives in the vitest unit lanes); it contributes zero undefined steps. `lint:gherkin` (syntax) passes clean.
**Build:** ✅ Success (tsup)
**Lint:** ✅ Clean (eslint src + tests, lint-gherkin, tsc --noEmit)
**Scenarios:** All 21 scenarios marked complete (R/G/R stamped with commit SHAs across build-steps 1–6)
**Dep Drift:** ✅ Clean — `sync-config --check` reports config in sync; no new runtime dependencies added (the GitHub adapter shells out to `gh`)
**Parent Epic:** N/A (no parent/epic)
**Reconcile:** ✅ impl-plan reconciled → implemented; all six Decisions held; one recorded deviation (Linear live client deferred to 2TK5AD — writer logic ships + tested over the port)

**Quality Review:** ✓ Passed (done-gate, ≥2-loop) — web-verified the `gh` issue create/edit/close interface (correct) and surfaced the label-preexistence gotcha. Independent fresh-context reviewer found two real correctness holes → both fixed → re-review **APPROVE**: (1) AC8 crash-safety was only test-deep (`markPending` never called in production) — now `projectOne` persists per ticket (markPending+save→record+save), so a mid-corpus crash reconciles instead of double-creating; (2) AC13 retry was unreachable live (the `gh` adapter threw plain `Error`) — `runGh` now rethrows `RateLimitError` on rate-limit signals so `withBackoff` retries. Added a command-level error catch (no token leak).

**Audit:** Audit passed — config in sync; depcruise clean (18 modules in tracker-sync, no violations; full tree no violations); jscpd 0 clones on the new module (19 files, 0.00%); no new dead code (knip's `gh` "unlisted binary" is an expected runtime subprocess, matching the existing `codex`/`ruff`/`mypy` precedent — not a finding); tests use meaningful assertions, injected fakes (no real timeouts — backoff sleep is injected), `it.each` for parameterized cases, and fresh per-test state. Errors 0, Warnings 0 on the changed surfaces.

## Evidence

- payload builder (AC3, AC10): `f4c50ee`
- tracker-map sidecar (AC5/6/8/9 foundation): `827655a`
- secrets + backoff (AC11, AC13): `fafa40d`
- writers + TrackerClient seam (AC4, AC7): `1e86033`
- orchestrator single call site (AC1/2/5/6/8/9/10/11/12/13): `6412112`
- CLI command + config + corpus + live gh adapter: `1328141`
- Full suite: 222 files / 3286 passed / 5 pre-existing skips (background run `b81biola6`, exit 0)
- Command smoke: `safeword sync-tracker` with no config → "No tracker configured; run `safeword setup`…" (exit 0)

## Notes / out of scope

- **Linear live client** is deferred to the connect-flow ticket (2TK5AD), which owns Arcade auth/setup — the Linear _writer_ ships and is unit-tested over the `TrackerClient` port; only the live I/O shim defers (it surfaces an actionable error). Recorded as a known deviation in impl-plan.md.
- **Gherkin lane redness** is pre-existing tech debt (features merged without step defs/@wip), tracked by #341 — not introduced by this ticket.
