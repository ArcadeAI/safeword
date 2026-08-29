## Verify Checklist

**Test Suite:** ✓ 8503/8503 tests pass (7 skipped; full suite passed twice)
**Gherkin:** ⚠️ Local environment limitation: real-machine review-routing scenarios cannot find a trusted Claude or Codex executable on this host; failures are outside the host-toolchain diff
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 0 scenarios marked complete (task uses a focused regression test; existing `honor-host-toolchains` behavior remains unchanged)
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — internal formatter dispatch repair
**Surface Evidence:** ✅ 2/2 affected surfaces have recorded proof
**Evidence limits:** ⚠️ Real-machine review-routing acceptance cases lack trusted reviewer binaries; root mypy scans duplicate-name experiment fixtures, while the authoritative per-package TypeScript typecheck is green

Audit passed for the diff: dependency boundaries, parity, docs impact, and changed-test quality are clean. The principle checker also printed pre-existing errors in two unchanged historical tickets; neither path is in this diff.

| Affected surface | Proof | Result |
| --- | --- | --- |
| Safeword host-toolchain runner | `SAFEWORD_TEST_LOCK_MAX_WAIT_MS=0 bun run --cwd packages/cli test tests/hooks/host-toolchain.test.ts` | 25/25 pass; local Ultracite reaches sibling local Biome and ignores global Biome |
| Installed Arcade hook | Resolve and run `.safeword/hooks/lib/host-toolchain.ts` against `apps/dashboard/src/app/eventing-management.browser.test.tsx` | Local `.bin/ultracite` selected; local Biome completed with no warnings or errors |

No clear-win cross-scenario refactor remained: the fix reuses the validated launcher path and the existing command runner without adding formatter-specific branches.
