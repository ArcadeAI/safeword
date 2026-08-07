# PR #1522 review round 12 — decisions

Scope: the single new PR review comment, after commit `4773b45fd`. The live
[issue #1479](https://github.com/ArcadeAI/safeword/issues/1479) remains the
canonical contract.

## Quality-review plan

- Currency: confirm the timer claim against current Node documentation.
- Correctness: compare retry, acknowledgement, and rejection concerns with the
  durable request/dead-letter rules in the live issue.
- Structure: distinguish authoritative state precedence from sibling cleanup
  order before extracting state-machine code.
- Wiring: ensure the URL fix exercises the actual spool and delivery function,
  with only the network boundary mocked.

## Figure-it-out: invalid configured relay URL

- [x] Phase 1: Decide whether an invalid relay URL is a retryable delivery
  failure or a fail-fast configuration error, without losing the request.
- [x] Phase 2: Options were (1) retry it, (2) validate before claiming, or
  (3) persist it to a second local error queue.
- [x] Phase 3a: Research domains: URL validation boundary, durable spool state
  machine, operator recovery, and retry-budget semantics.
- [x] Phase 3b: `normalizeRelayOrigin` already provides the strict HTTPS/no
  path-or-credentials validation used by command configuration; #1479 requires
  durable acceptance before a retry budget can apply.
- [x] Phase 4: Choose (2). It preserves the original durable request and avoids
  consuming its retry window for an error that cannot heal without an operator.

The regression test proves that a bad URL rejects before a network call, claim,
or retry schedule. The production command already rejects invalid configured
relay settings before native filing; this closes the lower-level direct-call
path too.

**Premortem:** If URL validation later becomes less strict than command
configuration, direct callers could again diverge; retain the shared
`normalizeRelayOrigin` helper at both boundaries.

**Next:** Keep the shared validator and run the focused delivery and command
suites.

## Figure-it-out: remaining review items

### Batch persistence timing

- [x] Phase 1: Decide whether to restore a wall-clock ceiling for the batch
  snapshot test.
- [x] Phase 2: Options: a raw elapsed-time assertion, a structural single-
  snapshot assertion, or no regression test.
- [x] Phase 3a: Research domains: Node timer/runtime guarantees, algorithmic
  regression testing, and CI determinism.
- [x] Phase 3b: Current Node documentation says timer callback timing and
  ordering are not guaranteed. The test therefore observes the load-bearing
  behavior directly: one state snapshot for 50 inserts with 500 queued files.
- [x] Phase 4: Keep the structural assertion. A sub-second wall-clock threshold
  failed in CI without identifying an algorithmic regression.

**Premortem:** A future implementation could retain one snapshot while doing
hidden quadratic work elsewhere; add an injected operation-count seam only if
that code path gains a second scan.

**Next:** Keep the existing real filesystem batch test; do not restore a flaky
clock assertion.

### Claim relinking and precedence

- [x] Phase 1: Decide whether the claim/recovery paths are unsafe duplicates or
  whether a broad extraction is warranted before merge.
- [x] Phase 2: Options: extract a generic relinker, add acknowledgement guards
  to every transition, or retain explicit transitions with focused guards.
- [x] Phase 3a: Research domains: filesystem-state ownership, acknowledged
  tombstones, race recovery, and refactor blast radius.
- [x] Phase 3b: The snapshot state-rank table selects authoritative *live
  state*. The recovery sibling lists instead look for byte-identical files to
  clean up; their order is not a competing state-precedence policy. The source
  acknowledgement is an indefinite source-identity tombstone required by #1479,
  not a temporary artifact to delete.
- [x] Phase 4: Retain the explicit transitions. `rearmClaim` alone must avoid
  reviving work after a completed acknowledgement; the other paths create or
  retain a visible dead letter. A generic relinker would erase those distinct
  ownership rules without reducing a demonstrated defect.

**Premortem:** A new transition might accidentally treat a cleanup sibling
order as authority; require it to use the snapshot rank when it selects a live
request state.

**Next:** Defer module-level consolidation; it is a dedicated state-machine
refactor, not a safe review-round patch.

### GitHub 403/422 and protocol version

- [x] Phase 1: Decide whether 403/422 responses should be terminal locally and
  whether the current version header needs negotiation.
- [x] Phase 2: Options: classify from response prose, classify all 403/422 as
  rejected, or retain them durably until the 24-hour deadline/dead letter;
  negotiate versions or use the explicit compatibility handshake.
- [x] Phase 3a: Research domains: GitHub REST status semantics/rate limits,
  duplicate prevention, and relay protocol compatibility.
- [x] Phase 3b: GitHub documents REST rate limiting separately from endpoint
  status contracts; a status-only 403/422 rule cannot safely distinguish a
  permanent policy rejection from a temporary limit or remediable credential
  state. #1479 chooses visible durable dead letters over silent loss and calls
  raw GitHub issue bodies—not response prose—the duplicate-marker authority.
- [x] Phase 4: Retain retry-to-dead-letter for these ambiguous client outcomes
  and retain the explicit protocol compatibility handshake, rather than invent
  negotiation. A terminal server receipt remains terminal when received.

**Premortem:** An indefinitely retrying permanent rejection could hide too long;
the existing 24-hour deadline converts it to a visible dead letter with the
same request identity.

**Next:** Do not add brittle prose parsing or status-only terminal handling.

## Provenance

- [Node timers documentation](https://nodejs.org/api/timers.html), fetched
  2026-08-01: Node does not guarantee exact callback timing or ordering.
- [GitHub REST issues documentation](https://docs.github.com/en/rest/issues/issues),
  fetched 2026-08-01: current issue endpoint authority.
- [GitHub REST rate-limit documentation](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api),
  fetched 2026-08-01: rate limiting is a separate REST concern.
- [GitHub #1479](https://github.com/ArcadeAI/safeword/issues/1479), fetched
  2026-08-01: repository-specific canonical durability contract.
