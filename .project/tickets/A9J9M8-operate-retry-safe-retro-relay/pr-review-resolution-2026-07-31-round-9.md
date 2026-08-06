# Figure It Out: ninth-round relay review

Source: [PR #1522 ninth-round review](https://github.com/ArcadeAI/safeword/pull/1522#issuecomment-5140108479). The [#1479 issue body](https://github.com/ArcadeAI/safeword/issues/1479) remains the canonical contract.

## Investigation checklist

- [x] Phase 1: Frame the decisions
- [x] Phase 2: Generate concrete options
- [x] Phase 3a: Enumerate research domains
- [x] Phase 3b: Research each domain
- [x] Phase 4: Debate and commit

## Phase 1 — frame

Decide how the local durable spool can make bounded, fair progress after
failures without starting requests it cannot finish, minting an identity after
corruption, or enabling routing on stale evidence.

Wrong means either a durable request is silently re-identified, a poison entry
can indefinitely starve healthy work, or the measured readiness evidence does
not describe the code that will run.

## Phase 2 — options

### A. Delivery fairness and deadline

1. Keep the remaining-time clamp and start a partial final request.
   It maximizes attempts in one invocation, but knowingly starts an HTTP call
   that cannot receive a complete response.
2. Restore the full-attempt admission check only.
   It never starts a doomed request, but one or two earliest poison requests
   can still consume every invocation forever.
3. Persist retry scheduling separately from the immutable request, then admit
   only full attempts with cleanup reserve.
   A small request-ID-keyed scheduling sidecar holds `attemptCount` and
   `nextAttemptAt`; request bytes, `requestId`, source reservation, and payload
   digest remain immutable. A failed delivery advances that sidecar atomically;
   an acknowledged/dead-letter/discarded request removes it.

### B. Corrupt active records

1. Quarantine every corrupt primary and allow all new persistence.
   This makes the queue available but cannot prove that a new source is not a
   replay of the corrupted request.
2. Fail the whole persistence batch for every corrupt primary.
   Safe but lets a reserved, unrelated corrupt record block all work.
3. Quarantine only when a valid source reservation proves the request belongs
   to a different source; otherwise preserve the corrupt record visibly and
   fail new persistence closed.

### C. Drain evidence

1. Accept v1 and v2 evidence indefinitely.
   Compatible but permits an enabled manifest to rely on evidence that lacks
   its runtime budgets.
2. Require v2 only for `drainThroughput` when a manifest enables routing, and
   require its recorded request/aggregate budgets to equal exported production
   constants.
3. Version the whole manifest again now.
   Strict but expands an already-disabled rollout gate without a need.

### D. Timing test and persistence scans

1. Raise the wall-clock threshold.
   Reduces flakes but proves nothing about rescans.
2. Remove the performance test.
   Avoids flaky CI but loses the regression signal.
3. Test observable scans, reuse the first snapshot when no malformed active
   record exists, and rescan only after a quarantine transition.

### E. Structural cleanup

1. Perform the proposed full state-machine rewrite.
2. Take only mechanics that have a behavior-preserving proof: give `RelayClaim`
   its `projectDirectory`, collapse the identical relink helper, and use one
   documented precedence table.
3. Defer all structural work.

## Phase 3a — research domains

- #1479 idempotency, ambiguous-create, and immutable identity contract.
- Durable local queue scheduling: atomic state updates, retries, fairness, and
  crash recovery.
- Node timer semantics and monotonic deadline measurement.
- Readiness/provenance evidence and schema compatibility.
- Filesystem scan complexity, observable test design, and CI timing variance.
- Relay state-machine ownership, operator recovery, and source tombstone
  lifecycle.
- GitHub documented create-outcome classification at the separate server
  boundary.

## Phase 3b — evidence

- #1479 requires a request identity generated once before first delivery,
  rejects payload mismatches, and says corrupted/ambiguous state must never be
  escaped with a new identity. Its client-spool section explicitly requires
  retry rearming/backoff and visible corruption.
- The current client serializes immutable request bytes and source reservations,
  but `rearmClaim` restores a failed primary byte-for-byte. Ordering therefore
  selects the same early deadline on every run; it supplies neither backoff nor
  fairness.
- The current clamp gives a final request less than its configured deadline.
  Node documents that `setTimeout` has no exact timing or ordering guarantee,
  so a wall-clock assertion at the deadline is inherently unsuitable as the
  proof of the state-machine property. [Node timers](https://nodejs.org/api/timers.html)
- The current quarantine can only identify the request ID from its filename.
  If its active bytes and source reservation are both unavailable, no durable
  evidence can connect it to a source key. Creating for any incoming source
  then risks a second request ID for the original finding.
- The producer already imports the production 500 ms request deadline and
  250 ms aggregate headroom. The validator can therefore compare v2 evidence
  against those same constants without duplicating policy.
- The double scan is required only after quarantine mutates the directory. In
  the ordinary valid-record path, the first recovered snapshot is still a
  coherent index and can be reused.
- Server-side GitHub 403/422 classification is a separate concern from this
  local delivery change. The current relay treats both retryably; resolve it
  only from documented GitHub status/header semantics, never response prose.

## Phase 4 — debate and decisions

### 1. Fair bounded delivery

Option 2 is attractive because it is tiny and never starts a partial request,
but it fails the reviewer’s two-poison counterexample. Option 1 improves a
single run but knowingly converts remaining session time into an abort, which
can be an accepted server-side request with a lost client response.

> Recommend **option 3: durable request-ID-keyed retry scheduling plus full-attempt admission with a cleanup reserve** because it is the smallest change that both prevents repeated head-of-line starvation and avoids intentional partial delivery. Option 2 was close on the deadline but loses on persistent fairness.
>
> **Premortem:** A retry sidecar could diverge from the primary after a crash; write it atomically, treat missing metadata as immediately due, and test every terminal transition removes it.
>
> **Next:** Add a RED test with two real aborting poison fetches and healthy requests, then implement `nextAttemptAt` sidecars in `packages/cli/src/retro/relay-delivery.ts`.

The admission predicate is `remaining >= requestDeadline + cleanupReserve`;
do not clamp an individual HTTP attempt. Start with a named 100 ms reserve,
measure it through the existing drain producer, and retain the outer 750 ms
aggregate policy. A failed request backs off before the next command; healthy
records are eligible immediately in the next invocation.

### 2. Unreserved corrupt active record

Option 1 is available-first but is incompatible with the canonical no-new-ID
rule. Option 2 is safe but unnecessarily blocks records whose valid source
reservation proves their identity is unrelated.

> Recommend **option 3: reservation-proven quarantine, otherwise visible fail-closed persistence** because no valid evidence exists to safely map an unreserved corrupt primary back to its source. It is stricter than the prior round and conforms to #1479’s identity invariant.
>
> **Premortem:** A genuine unrelated corrupt artifact could hold the batch until an operator intervenes; make the error name the request ID and the retry/discard recovery command, rather than hiding it.
>
> **Next:** Restore a fail-closed test for a corrupt primary without a valid source reservation and retain the isolation test for a reservation-proven different source.

### 3. Readiness evidence

Option 1 keeps legacy artifacts too powerful; option 3 creates a broader
manifest migration when only the drain artifact changed.

> Recommend **option 2: v2-only drain evidence for an enabled manifest, with exact production budget equality** because readiness must attest the configuration that is actually shipped. Legacy v1 parsing may remain for disabled/history inspection but must not enable routing.
>
> **Premortem:** A future intentional budget change could make valid evidence fail closed; that is desirable until the producer re-runs and the evidence is reviewed for the new constants.
>
> **Next:** Make `validateRelayReadiness` reject v1 drain evidence and unequal v2 timing values whenever `manifest.enabled` is true.

### 4. Timing proof and scan cost

Option 1 papers over a CI discrepancy; option 2 removes the only signal.

> Recommend **option 3: test scan behavior, not elapsed wall-clock, and avoid the second scan unless quarantine changed durable state** because Node does not guarantee timer precision and the implementation can directly expose the property under test.
>
> **Premortem:** Reusing a stale snapshot after a concurrent mutation could miss a reservation; retain the existing final state snapshot/CAS checks and rescan after any quarantine mutation.
>
> **Next:** Replace the 1000 ms persistence assertion with injected directory-read instrumentation and make `quarantineMalformedActiveRequests` return whether it changed state.

### 5. Structure

Option 1 is too risky for a disabled-but durability-sensitive state machine;
option 3 leaves cheap correctness ambiguity in place.

> Recommend **option 2: three behavior-preserving reductions only** because passing `projectDirectory` explicitly, sharing the relink transition, and defining one precedence table delete incidental complexity without re-proving the complete state machine.
>
> **Premortem:** A shared relink helper could erase the delivery/recovery guard difference; encode its terminal-path and acknowledgement policy as arguments and add parity tests first.
>
> **Next:** Add transition-parity tests before extracting the relink helper; defer compaction and the one-record rewrite to a follow-up ticket.

### 6. Server create classification

> Recommend **keep it a separate, documented-status/header-only server fix** because it does not change local request identity or client delivery scheduling, and response prose is not a stable authority. A 403/422 classification change must add integration coverage for permanent versus rate/abuse outcomes.
>
> **Premortem:** Treating an uncertain server response as terminal could lose a request; default unknown outcomes to ambiguous/recoverable, never a fresh create.
>
> **Next:** Open or link a narrowly scoped relay-server follow-up before altering `packages/retro-relay/src/github.ts`.
