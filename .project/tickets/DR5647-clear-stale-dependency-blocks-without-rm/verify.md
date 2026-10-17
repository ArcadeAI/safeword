# Verification: clear stale-dependency blocks without rm (#5647, #5188)

## Verify Checklist

**Test Suite:** ✓ 11241/11241 tests pass (14 skipped; full package suite at a34a3a8d); hosted CI re-runs on the final head
**Gherkin:** ✅ Acceptance lane passes (47/47 locally)
**Build:** ✅ Success
**Lint:** ✅ Clean (CI `lint` green at 9eca35f1)
**Typecheck:** ✅ Clean
**Scenarios:** ⏭️ Skipped — task ticket, no feature scenarios
**Refactor:** ✅ No change warranted — new tests follow the file's inline-setup pattern; sentinel path helper mirrors the marker path in two lines
**PR Scope:** ✅ Diff matches ticket scope — readiness template plus its generated mirrors, fixture digests, and tests; older defects split into follow-ups
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — Walked an agent on a stale bun project through the real pre-tool hook; worst step = the install itself; new steps vs before = 0 (same one command, minus `rm`)
**Surface Evidence:** ✅ 2/2 affected surfaces have recorded proof
**Evidence limits:** ✅ None — the local `deps` lane flagged a Python urllib3 advisory, but CI `Dependency audit` passes at 9eca35f1

## Surface evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Claude pre-tool dependency gate | `dependency-readiness.test.ts` › pre-tool hook clears its own stale block once the printed recovery runs (#5647), spawning the real hook; plus a manual run on a throwaway bun project with the final code | Pass; fails against main (receives the `rm -f` command). Manual: denied with version note and `touch node_modules/.safeword-deps-reinstalled-<fp12>`; then allowed, no sentinels left, marker equals the input fingerprint |
| Codex/Cursor done gate | `done-gate.test.ts` › clears a stale-dependency block once its printed recovery runs (#5647) | Pass; fails against main (receives the `rm -f` command) |

## Reviews

- Final `/tdd-review` (2026-10-17): fixed a coarse-clock-fragile mtime assertion; added the automated real pre-tool hook proof above.
- Mutation checks: fingerprint-named acceptance, marker stamp, sentinel cleanup on stamp, discarding non-matching sentinels, and artifact-mtime restore are each caught by a failing test when removed.
- Cross-agent quality-review (Codex, independence: cross-agent), five rounds: four sentinel defects fixed (see ticket work log); the fifth (unobserved manual install between input switches) reproduced on main's marker and answered as pre-existing, filed as a follow-up. Implement-exit stamp recorded as a skip with that reason.
- Audit passed — diff scope: no dependency-cruiser violations, no learnings or domain-doc findings.
