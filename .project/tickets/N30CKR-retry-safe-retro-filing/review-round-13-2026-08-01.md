# PR #1522 review round 13 — decisions

Scope: the thirteenth-round PR review at `8a0cd4b5f`, plus the edited
open-items index. The live [issue #1479](https://github.com/ArcadeAI/safeword/issues/1479)
is the canonical contract.

## Quality-review plan

- Correctness: verify that configuration failure preserves the original durable
  request and does not bypass the relay identity/authorization boundary.
- Test integrity: determine whether a wall-clock batch threshold proves the
  required complexity more reliably than an observed snapshot count.
- State-machine structure: distinguish live-state authority from recovery
  cleanup mechanics before consolidating transitions.
- Currency: check current Node timer guarantees before retaining or adding a
  performance timing assertion.

## Figure-it-out: command handling of a defensive invalid route

- [x] Phase 1: Decide whether an internal invalid relay route should reject the
  command or return a durable, actionable command outcome.
- [x] Phase 2: Options: preserve the throw, catch every relay-pipeline error,
  or catch delivery errors after persistence.
- [x] Phase 3a: Research domains: CLI error recovery, durable-spool lifecycle,
  configuration validation, and operator observability.
- [x] Phase 3b: Production validates an enabled route before it reaches
  delivery, but the injected composition seam can reach the defensive URL
  guard. #1479 requires bounded availability behavior without discarding the
  accepted draft.
- [x] Phase 4: Catch only `deliverRelayRequests` errors after batch persistence.
  It converts the defensive path into `ok: false` with `agentFilingNeeded`,
  while avoiding a broad catch that could hide a persistence failure.

> Recommend **a delivery-only catch** because the request has already been
> durable when delivery starts. A broad catch was close on future-proofing but
> loses the distinction between failed persistence and deferred delivery.
> Cite: [#1479](https://github.com/ArcadeAI/safeword/issues/1479).
>
> **Premortem:** A future delivery error could expose an unsafe message; keep
> delivery errors controlled or classify any new external error before rendering.
>
> **Next:** Preserve the command-level regression that asserts the durable draft
> remains queued.

## Figure-it-out: batch timing assertion

- [x] Phase 1: Decide whether to restore a raw elapsed-time ceiling.
- [x] Phase 2: Options: restore a ceiling, retain a structural observation, or
  remove coverage.
- [x] Phase 3a: Research domains: Node scheduling guarantees, CI variance, and
  algorithmic complexity testing.
- [x] Phase 3b: Current Node documentation states that callback timing and
  ordering are not guaranteed. The test directly observes the one shared state
  snapshot that prevents an N×M directory rescan.
- [x] Phase 4: Retain and explain the structural assertion. It is deterministic
  and fails if the batch path starts taking one snapshot per draft.

> Recommend **the single-snapshot assertion** because it measures the actual
> algorithmic invariant. A wall-clock ceiling is close in user intent but loses
> on CI determinism. Cite: [Node timers](https://nodejs.org/api/timers.html).
>
> **Premortem:** Another hidden scan could be introduced without touching this
> seam; add an operation-count seam only if a second scan is added.
>
> **Next:** Keep the explanatory test comment with the structural assertion.

## Figure-it-out: configuration and structural items

- [x] Phase 1: Decide whether incomplete enabled configuration should fall back
  to native filing, and whether the three claim transitions can safely share one
  generic relinking helper.
- [x] Phase 2: Options: native fallback versus fail-closed configuration error;
  generic relinker versus explicit state transitions.
- [x] Phase 3a: Research domains: transport-independent identity, authorization
  boundaries, durable tombstones, filesystem ownership, and recovery races.
- [x] Phase 3b: #1479 scopes identity and authorization to the relay boundary;
  native fallback after enabling that boundary could create outside its durable
  record. The snapshot precedence table chooses authoritative *live* state,
  whereas the recovery sibling lists only find byte-identical cleanup targets.
- [x] Phase 4: Keep fail-closed configuration and explicit transitions. The
  acknowledgement guard prevents rearming already-acknowledged work; dead-letter
  and recovery paths deliberately preserve visible terminal work instead.

> Recommend **the existing fail-closed route and explicit transitions** because
> neither proposed simplification preserves the contract's ownership semantics.
> Cite: [#1479](https://github.com/ArcadeAI/safeword/issues/1479).
>
> **Premortem:** A later transition may conflate cleanup order with authority;
> require it to use the state-rank snapshot when choosing a live state.
>
> **Next:** Defer a generic state-machine extraction to a dedicated refactor with
> race-transition tests; do not hide it in this review patch.

## Provenance

- [Node.js timers documentation](https://nodejs.org/api/timers.html), fetched
  2026-08-01: exact callback timing and ordering are not guaranteed.
- [Node.js URL documentation](https://nodejs.org/api/url.html), fetched
  2026-08-01: current URL API reference for the shared route validator.
- [GitHub #1479](https://github.com/ArcadeAI/safeword/issues/1479), fetched
  2026-08-01: canonical request identity, durability, and authorization rules.
