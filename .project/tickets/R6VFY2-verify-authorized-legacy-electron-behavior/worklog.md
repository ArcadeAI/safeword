# Implementation work log

## Root Cause: policy imported the private cutoff mechanism

The existing import-boundary regression failed during the snapshot protection
run on 2026-11-23. The new policy module imported the history core solely to
inspect the Git remote. That violated the existing rule that only the pinned
history entry point can reach the cutoff override mechanism.

Confirmed by the failed source inventory: the extra importer was
`retrospective-policy.ts`. Ruled out an obsolete test: the private cutoff
boundary is still required for both enrolled migrations. Ruled out the new
archive helper exports: none imports the history core. Keep the test unchanged;
perform Git inspection in the existing history entry point and make remote
matching a pure policy operation. This is a local implementation regression,
not a change to the feature's accepted scope or ticket type.

## Remaining delivery

- [ ] Implement and protect independent Electron snapshot execution.
- [ ] Expose and prove the installed public observation command.
- [ ] Add authenticated row failure records and exact-set closing replay.
- [ ] Run all 17 actual original/mutant proofs and independent reviews.
- [ ] Complete verification, audit, refactor, and PR readiness.

Original Soulless historical entries remain unchanged. Portable fixture reports
are process-wiring protection and never substitute for real Electron evidence.
