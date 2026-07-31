# Eighth-round PR review resolution

Source review: https://github.com/ArcadeAI/safeword/pull/1522#issuecomment-5134416257

## Quality review

Review plan: validate the live #1479 durability and single-owner invariants;
trace persistence before delivery; exercise bounded-drain failure ordering;
check terminal receipt routing; and verify HTTP/header claims against current
Node documentation. The review found two correctness regressions (corrupt
records can block unrelated persistence and one timeout can consume the full
bounded drain), plus missing evidence metadata and receipt validation. Native
fallback for a server-owned terminal receipt is rejected: it would create a
second filing owner.

## Decision 1: Corrupt durable records

- [x] Phase 1: Decide whether a malformed request may block unrelated new
      drafts after it has become visible as a dead letter.
- [x] Phase 2: Options: keep global fail-closed rejection; ignore every dead
      letter; or quarantine malformed active records and exclude malformed dead
      letters while preserving valid dead-letter source reservations.
- [x] Phase 3a: Research domains: #1479 durable-identity invariant, atomic
      filesystem visibility, source-reservation recovery, and batch isolation.
- [x] Phase 3b: The live contract requires visible corruption and forbids
      silent deletion, but does not authorize one unknown record to reject
      unrelated durable work. Normal writes create a source reservation before
      the request, so a known source remains fenced after quarantine.
- [x] Phase 4: Quarantine malformed active files into the visible dead-letter
      state, then omit malformed dead letters from the source map. Do not delete
      bytes or treat an unknown source as authoritative.

> Recommend **visible quarantine plus non-authoritative malformed dead letters**
> because it preserves evidence without turning one foreign/torn file into a
> global availability failure. Keeping global rejection was closer on unknown
> identity, but loses on unrelated durable drafts.
>
> **Premortem:** quarantine could allow a same-source replay to mint a new ID;
> preserve and consult valid source reservations before creating any request.
>
> **Next:** add persistence-before-delivery regressions in
> `packages/cli/tests/retro/relay-delivery.test.ts`.

## Decision 2: Bounded-drain head-of-line blocking

- [x] Phase 1: Decide how a 500 ms timeout and 750 ms aggregate budget should
      behave after the first request consumes its full timeout.
- [x] Phase 2: Options: persist failure counts and demote requests; retain the
      fixed per-attempt floor; or cap each later attempt by remaining aggregate
      time while retaining a small cleanup reserve.
- [x] Phase 3a: Research domains: bounded-latency scheduling, retry fairness,
      abort semantics, and #1479's sub-second return requirement.
- [x] Phase 3b: A durable failure counter changes state/schema and still leaves
      a bad request first on its first failure. A dynamic cap keeps the request
      deadline as a maximum, preserves the aggregate bound, and lets an
      immediately healthy request use the remainder.
- [x] Phase 4: Use the lesser of the configured request deadline and the
      remaining aggregate time minus cleanup reserve; rearm any timed-out
      attempt under its original identity.

> Recommend **dynamic remaining-budget attempt deadlines** because it removes
> deterministic head-of-line blocking without a new durable scheduling state.
>
> **Premortem:** a short final attempt may timeout a slow healthy relay; it is
> safely rearmed and will receive a full budget in a later run.
>
> **Next:** add a poison-first plus healthy-following fault-injection test.

## Decision 3: Server terminal receipts

- [x] Phase 1: Decide how the command signals server-owned unresolved terminal
      receipts without violating the one-owner filing boundary.
- [x] Phase 2: Options: invoke native filing; retain exit-zero logging; or make
      unresolved terminal receipt states a visible command failure while leaving
      tombstones with an issue reference successful.
- [x] Phase 3a: Research domains: #1479 durable acceptance, terminal recovery,
      CLI exit semantics, and duplicate-side-effect prevention.
- [x] Phase 3b: Native fallback after durable server ownership can create a
      second issue. Exit-zero hides an unresolved terminal outcome. A nonzero
      result preserves server ownership and tells automation to surface it.
- [x] Phase 4: Fail visibly for `rejected`, `dead-letter`, and issue-less
      `tombstone`; do not route them to the native filer.

> Recommend **operator-visible command failure without native fallback** because
> durable server ownership must never become a second client create.
>
> **Premortem:** callers may treat a tombstone as failure even when it references
> an issue; distinguish the issue-bearing tombstone explicitly.
>
> **Next:** characterize command outcomes for every reported terminal receipt.

## Decision 4: Drain evidence and malformed protocol input

- [x] Phase 1: Decide whether a readiness artifact must attest its timing
      configuration and how invalid relay responses/version errors are handled.
- [x] Phase 2: Options: retain an unparameterized v1 artifact and hard terminal
      400; evolve the exact evidence schema and preserve v1 readers; or add
      negotiation/capabilities.
- [x] Phase 3a: Research domains: evidence reproducibility, strict schema
      evolution, HTTP duplicate-header behavior, and frozen API-v1 semantics.
- [x] Phase 3b: Current Node HTTP documentation says header values are not
      parsed by Node and duplicates need explicit handling. #1479 requires
      fail-closed unknown receipt states, not automatic protocol negotiation.
- [x] Phase 4: Produce a v2 drain artifact using production defaults and record
      both budgets; accept legacy v1 only for legacy evidence, require v2 for a
      future readiness enablement, parse response bodies before acknowledgement,
      and retry incompatible-version failures until the shared deadline.

> Recommend **versioned evidence plus fail-closed receipt parsing** because an
> attested measurement must identify the configuration that produced it. API
> negotiation was close, but expands a deliberately frozen v1 contract.
>
> **Premortem:** an old artifact could enable readiness without parameters;
> require v2 specifically when the manifest is enabled.
>
> **Next:** add RED tests for artifact v2, malformed receipts, and version
> mismatch retryability.
