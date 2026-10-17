# Verification: clear stale-dependency blocks without rm (#5647, #5188)

## Verify Checklist

**Test Suite:** ✓ 247/247 tests pass (dependency-readiness, done-gate, lifecycle origin-main contract at 84f07532); full suite 10528/10528 (14 skipped) at 0366c2dc7; hosted CI re-runs on the ticket-closure head
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
| Claude pre-tool dependency gate | Real `pre-tool-dependency-readiness.ts` run on a throwaway bun project: stale → printed recovery (install stubbed with `true`) → retry (earlier sentinel name; acceptance now proven by unit tests) | Denied with version note and recovery; then allowed, sentinel consumed, marker re-stamped |
| Codex/Cursor done gate | `done-gate.test.ts` › clears a stale-dependency block once its printed recovery runs (#5647) | Pass; fails against main (receives the `rm -f` command) |

## Reviews

- Mutation checks: fingerprint-named acceptance, marker stamp, sentinel cleanup on stamp, discarding non-matching sentinels, and artifact-mtime restore are each caught by a failing test when removed.
- Cross-agent quality-review (Codex, independence: cross-agent), five rounds: four sentinel defects fixed (see ticket work log); the fifth (unobserved manual install between input switches) reproduced on main's marker and answered as pre-existing, filed as a follow-up. Implement-exit stamp recorded as a skip with that reason.
- Audit passed — diff scope: no dependency-cruiser violations, no learnings or domain-doc findings.
