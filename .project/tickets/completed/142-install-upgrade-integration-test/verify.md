Verified: 2026-05-13T23:56:00Z

## Verify Checklist

**Test Suite:** ✓ 1565/1566 tests pass (1 skipped, 81 files)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** ⏭️ Skipped — task type, no test-definitions.md required
**Doc Refs:** ✅ Clean (only match for `planTextPatches`/`executeTextPatch` in `.md` is this ticket)
**Dep Drift:** ✅ Clean — `commander`, `yaml`, `vitest`, `prettier`, `knip`, `tsup`, `typescript` all documented in ARCHITECTURE.md
**Parent Epic:** N/A

## Evidence

- New: `packages/cli/tests/integration/install-upgrade.test.ts` — 6 cases (install absent / install over user heading / upgrade heals legacy artifact, × CLAUDE.md and AGENTS.md).
- Modified: `packages/cli/src/reconcile.ts` — `planTextPatches` drops marker check (lets executor handle heal on upgrade); `planTextPatchesWithCreation` delegates to it.
- Done-when from ticket:
  - [x] Revert `d6dce6d` → 2 install-over-heading tests fail. Restored → green.
  - [x] Revert `a304af8` → 2 upgrade-heal tests fail. Restored → green.
  - [x] Idempotency: case 3 runs `reconcile(..., 'upgrade', ...)` twice and asserts byte-stability.
  - [x] Test runtime added <1s to suite.
- PR: https://github.com/ArcadeAI/safeword/pull/85
