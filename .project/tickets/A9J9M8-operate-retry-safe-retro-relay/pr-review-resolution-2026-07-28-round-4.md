# PR Review Resolution: Round 4

Source:
[fourth-round review](https://github.com/ArcadeAI/safeword/pull/1522#issuecomment-5110230323)

The live body of
[GitHub issue #1479](https://github.com/ArcadeAI/safeword/issues/1479)
remains the canonical contract.

## Quality Review

**Currency:** ✓ Reviewed the exact `205164d62` implementation, live issue
contract, official Node filesystem documentation, GitHub REST issue
documentation, Debian Snapshot documentation, and current NIST key-management
guidance on 2026-07-28.

**Sources:** ✓ Every blocking claim is reproduced in the exact code or tied to a
current primary source.

**Correct:** ❌ D1, D4, and D5 are correctness defects. D2 and D3 are confirmed
operational gaps.

**Elegant:** ⚠️ Acknowledgement duplicates durable source state and persistence
repeats recovery scans. Discard recovery cannot distinguish a live intent from
an abandoned one.

**No-bloat:** ⚠️ Fix the five confirmed items without adding a second index,
database, or lossy persistence timeout.

**Wiring:** ✓ The built CLI already has a real-filesystem/subprocess discard
test. The resolution adds public-command recovery/listing coverage and
real-filesystem fault/concurrency coverage.

**Verdict:** REQUEST CHANGES

**Critical issues:** D1, D4, D5.

**Suggested improvements:** D2 and D3 before readiness. Keep N4 and R8 declined.
The N7 snapshot-host caveat is non-blocking.

**Provenance:**

- [Node filesystem API](https://nodejs.org/api/fs.html): promise-based
  filesystem operations are not synchronized; callers must handle races.
- [GitHub REST issue API](https://docs.github.com/en/rest/issues/issues):
  raw REST bodies remain the authoritative issue representation.
- [Debian Snapshot](https://snapshot.debian.org/): dated snapshots and
  `check-valid-until=no` are supported.
- [NIST SP 800-57 Part 1 Rev. 5](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt1r5.pdf):
  retained keys are a valid recovery strategy; re-encryption is optional future
  operational work rather than permission to destroy recoverability.
- Live issue #1479 and exact commit `205164d62`, fetched this session.

**Next:** Resolve D1–D5 through TDD, then repeat quality review and full
verification.

## Figure It Out: D1 Renewal Durability

- [x] Phase 1: Decide how uncertain renewed bytes remain coherent without
  treating a failed network response as authoritative rejection.
- [x] Phase 2: Compare rollback-on-any-non-2xx, compatible reconciliation in
  every client state, and server-receipt-only commit.
- [x] Phase 3a: Research ambiguous HTTP outcomes, local durable identity,
  crash recovery, and state-machine convergence.
- [x] Phase 3b: Verify the issue contract, current code, GitHub create
  limitations, and the public command reproduction.
- [x] Phase 4: Debate and commit.

Rollback is small but wrong after a timeout or 5xx because the relay may have
accepted the renewed exact request. Receipt-only commit cannot handle a lost
receipt. Compatible reconciliation preserves the uncertain request bytes and
keeps the source reservation coherent after dead-letter rearm.

> Recommend **compatible renewal reconciliation in every durable client state**
> because uncertain network outcomes cannot authorize rollback to bytes the
> relay may no longer recognize. Rollback was close for definitive 4xx
> rejection but loses on ambiguous acceptance.
>
> **Premortem:** A widened compatibility check could accept a payload mutation;
> mitigate by permitting only a later deadline with identical request ID,
> source key, creation time, and payload digest.
>
> **Next:** Route primary and materializing state through the same strict
> compatible-renewal reconciler and cover the two-command public reproduction.

## Figure It Out: D2 Persistence Cost

- [x] Phase 1: Decide how to bound Stop-hook work without weakening durable
  persistence.
- [x] Phase 2: Compare a persistence deadline, a second local index, and
  eliminating redundant files/recovery passes.
- [x] Phase 3a: Research durability guarantees, filesystem scan cost, crash
  recovery, and operator observability.
- [x] Phase 3b: Measure the current file model and trace nested recovery calls.
- [x] Phase 4: Debate and commit.

A hard persistence deadline can abandon a newly extracted finding, contrary to
invariant 4. A second index adds reconciliation debt. The acknowledged source
tombstone already has the required authority, so the active-name duplicate and
nested recovery passes are unnecessary.

> Recommend **one immutable source tombstone plus one recovery/directory
> snapshot per persistence** because it removes the measured growth mechanism
> without making durability time-dependent. A deadline was close on latency but
> loses on silent-loss risk.
>
> **Premortem:** Legacy unreserved files could become undiscoverable; preserve
> the one compatibility scan over the already captured durable snapshot.
>
> **Next:** Remove the acknowledged active-name copy, use exact source-reservation
> filenames, and share one recovered directory snapshot.

## Figure It Out: D3 and D4

Figure-it-out is skipped under the skill's single-obvious-answer rule.

- D3: the existing no-argument operator command must list active and dead-letter
  request identities with state labels; it must not reveal payloads.
- D4: `ENOENT` after a directory snapshot means another recovery process won.
  Treat it as a benign disappeared-state outcome and retry on a later pass.

## Figure It Out: D5 Live Discard Recovery

- [x] Phase 1: Decide how recovery distinguishes a live discard from a crash and
  how the original owner reports a concurrent terminal commit.
- [x] Phase 2: Compare immediate recovery, lease-only recovery, and
  lease-plus-idempotent convergence.
- [x] Phase 3a: Research filesystem ownership, crash detection, lease expiry,
  and idempotent terminal transitions.
- [x] Phase 3b: Verify Node filesystem race guidance and the exact intent/claim
  ordering.
- [x] Phase 4: Debate and commit.

Immediate recovery mistakes the normal live interval for a crash. Lease-only
recovery prevents that normal race but can still meet a paused owner after
expiry. Combining a short durable lease with terminal-state validation makes
both paths truthful.

> Recommend **lease-plus-idempotent convergence** because time separates normal
> ownership from crash recovery, while a valid tombstone makes a late original
> owner succeed rather than report a false failure. Immediate recovery is
> simpler but loses on truthful command results.
>
> **Premortem:** A process pause could outlive the lease; validate the terminal
> tombstone by exact request identity before treating lost token ownership as
> success.
>
> **Next:** Store intent expiry, skip unexpired intents during recovery, and
> accept only a matching terminal tombstone after token loss.

## Figure It Out: N4 Raw Evidence

- [x] Phase 1: Decide whether formatted marker evidence may authorize adoption.
- [x] Phase 2: Compare exact raw evidence, normalized marker matching, and
  missing-evidence adoption.
- [x] Phase 3a: Research duplicate safety, authority, human edits, and recovery.
- [x] Phase 3b: Verify the GitHub REST representation and canonical issue text.
- [x] Phase 4: Debate and commit.

> Recommend **retaining exact raw REST evidence** because #1479 explicitly
> requires conflicting or incomplete evidence to remain quarantined.
> Normalization improves recovery ergonomics but loses on duplicate authority.
>
> **Premortem:** Human edits may strand a valid issue; resolve through explicit
> operator reconciliation rather than weakening automatic evidence.
>
> **Next:** Keep N4 declined and do not use sanitized or normalized reads for
> duplicate decisions.

## Figure It Out: R8 Payload-Key Retention

- [x] Phase 1: Decide whether this slice must retire keys referenced by
  indefinitely recoverable rows.
- [x] Phase 2: Compare retaining referenced keys, online re-encryption, and
  compaction/deletion.
- [x] Phase 3a: Research cryptoperiods, archive recovery, authenticated
  re-encryption, and scope.
- [x] Phase 3b: Verify NIST guidance and #1479's indefinite-recovery contract.
- [x] Phase 4: Debate and commit.

> Recommend **retaining referenced keys in this slice** because deletion or
> compaction would destroy required ambiguous/dead-letter recovery. Online
> re-encryption is legitimate future operational work but adds a new migration
> state machine outside the smallest viable contract.
>
> **Premortem:** An old key becomes operationally burdensome; track online
> re-encryption separately before enforcing a cryptoperiod that conflicts with
> unresolved records.
>
> **Next:** Keep R8 declined and retain fail-fast startup validation for every
> uncompacted payload key.

## Figure It Out: Terminal Discard Source Identity

- [x] Phase 1: Decide whether explicit request discard may free the same source
  to acquire a new request identity.
- [x] Phase 2: Compare deleting the source reservation, retaining the active
  reservation, and compacting it to a terminal source tombstone.
- [x] Phase 3a: Research the canonical identity contract, crash convergence,
  operator intent, and acknowledgement precedence.
- [x] Phase 3b: Reproduce the current replacement-ID behavior through the public
  persistence path and verify the discard recovery boundaries.
- [x] Phase 4: Debate and commit.

Deleting the reservation makes discard an identity-reset operation,
contradicting the canonical rule that the source must reuse or reconcile its
original request before any new identity is issued. Keeping the full active
reservation prevents replacement but retains approved payload bytes
unnecessarily. A compact terminal source tombstone preserves only the identity
and payload digest needed to reject source reuse or suppress exact replay.

> Recommend **an indefinite discarded-source tombstone** because it preserves
> the transport-independent request identity contract without retaining the
> full approved payload. Deleting the reservation is smaller but permits a
> duplicate identity; retaining it is safe but keeps unnecessary payload bytes.
>
> **Premortem:** Discard and acknowledgement could race and leave both terminal
> source records; always read acknowledgement first, let acknowledgement remove
> a redundant discard tombstone during compaction, and never allow either path
> to recreate an active reservation.
>
> **Next:** Compact matching active reservations before removal, teach recovery
> the same transition, and prove exact replay after discard cannot mint a new ID.
