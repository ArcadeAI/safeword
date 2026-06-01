# SW1SE5 — Verify (feature)

Stop-gate incremental `tsc` for TS projects: implement-phase stops surface type
errors in changed code as soft advice. Verified via the `/verify` skill
(invocation logged this session).

## Verify Checklist

**Test Suite:** ✓ 2229/2229 tests pass (1 skipped; 132 files) — full `bun run test` on HEAD `3d6e3825` (the close-flow doc commits since touched only ticket markdown).
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint + `tsc --noEmit`)
**Scenarios:** All 28 scenarios marked complete (8 scenario blocks × RED/GREEN/REFACTOR + feature-level refactor; 0 unchecked; every SHA resolves)
**Dep Drift:** ✅ Clean — no dependencies added (Node stdlib + the project's own tsc)
**Parent Epic:** N/A — standalone ticket (a /figure-it-out follow-up)
**Audit:** Audit passed — see /audit this session (no architecture violations; new lib is focused; no dead code).

## What shipped

- `hooks/lib/typecheck-gate.ts`: `shouldRunTypecheck` (pure run-gate, monorepo
  find-up, `.ts/.tsx/.mts/.cts`), `runIncrementalTypecheck` (spawns
  `tsc --noEmit --incremental`, `--tsBuildInfoFile` → OS temp cache, 60s
  timeout), `evaluateImplementStopTypecheck` (composes behind a `TypecheckRunner`
  seam; surfaces only **file-level** type errors, not config failures like
  TS18003), and `changedFilesSinceHead` (git diff + untracked).
- `stop-quality.ts`: wired into the non-done path — after the `stopHookActive`
  bypass, before the LOC review throttle — surfacing advice via `softBlock`
  (never hard-blocks; the done gate stays the backstop).

## Coverage

- Rule 1 (run-gate): 6 unit tests. Rules 2/4: composition DI + real-tsc
  integration. Rule 3 (soft) + hook-level Rules 2-4: a spawn-the-real-hook
  integration test (error → decision:block exit 0; next `stop_hook_active`
  cycle allows the stop; done phase silent). Plus: no `.tsbuildinfo` lands in
  the repo; TS18003 config error stays silent. Real-tsc tests use an isolated
  temp project with a symlinked tsc.

Decision baked: soft-surface, not hard-block (a hard block on every implement
turn is punishing; done gate is the backstop). Per /figure-it-out, measured
warm tsc ≈0.7s and silent-when-clean, so it runs every implement-stop with TS
changes (not LOC-throttled).
