# Verify — Ticket P58R22: hook↔CLI markdown parser parity

## Verify Checklist

**Test Suite:** ✓ 2400/2400 tests pass (1 pre-existing skip; full suite, dist rebuilt)
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (eslint 0 warnings; typecheck 0 errors)
**Scenarios:** ⏭️ N/A — task; the deliverable is the differential test itself (`tests/hooks/parser-parity.test.ts`, 8 fixtures)
**Dep Drift:** ✅ Clean
**Parent Epic:** EECVXB (bdd-chain-hardening)
**Reconcile:** ✅ No new pattern — ported the CLI's existing `computeSkipMask`/`stripInlineComments` shape into the hook (the documented cross-runtime mirror)

## Audit

**Correctness:** ✅ the fence false-deny is closed — the hook now skips code fences like the CLI; the previously-divergent `fence_with_stray_comment` case agrees
**Anti-drift:** ✅ the differential test pins the hook's primitive copies byte-for-byte to the CLI originals; fails the moment either copy drifts (verified RED→GREEN on the fence gap)
**Known-accepted:** the consumer-level inline-strip asymmetry (hook uniform, CLI selective) is deliberate and benign — the hook, which drives the gate, strips a stray body-line comment _more_ cleanly than the CLI; documented in the test's scope note rather than re-architected
**Parity:** ✅ 116 pairs in sync

Audit passed

## Reopen note

P58R22 was first marked done with its Done-when (a differential test) unmet — the work log had substituted independent CommonMark-conformance tests, which structurally couldn't catch fence-axis drift. The epic-close quality-review caught this; the ticket was reopened, the fence parity fixed, and the differential test the ticket actually scoped was added. Done-when now met.

**Next:** Mark P58R22 done; close epic EECVXB.
