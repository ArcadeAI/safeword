# Impl Plan: Preserve cloud retros through service outages

**Status:** planned

## Approach

The riskiest assumption is that Claude Code Cloud can invoke a Safe Word
completion carrier and receive one public receipt before its task ends. Prove
that in a disposable hosted task before production code. The receiver design is
already aligned with existing SQLite/keyring patterns; the carrier is not.

1. Spike Claude Code Cloud only: install the smallest disposable completion
   carrier in a fixture project, have it post a fixed sanitized receipt marker
   to Railway, and inspect the real hosted receipt. Kill the Claude slice if
   the carrier does not run, lacks outbound access, or cannot complete in the
   500 ms budget. The spike produces evidence only; no production code is
   reused. Codex Cloud and Cursor Cloud Agents remain `skip: live receipt proof
   outstanding`, not assertions that their carriers do not exist.
2. If that spike validates, add `PublicQuarantineStore` and a versioned `public_quarantine` migration
   beside `retro_requests`. Its `BEGIN IMMEDIATE` insertion transaction performs
   canonical complete-envelope fingerprinting, existing-key dedupe, mutation
   conflict, global rate/capacity checks, encryption with the existing keyring,
   and receipt creation. Primary proof: `lifecycle.test.ts` using a temporary
   SQLite database; supporting migration/restart, duplicate, mutated-payload,
   final-slot, and explicit-delete tests. Node's documented `DatabaseSync` is a
   single synchronous connection, so the transaction—not a pretend mutex—is the
   serialization boundary.
3. Add explicitly deployment-enabled public routes and existing-operator-only
   list/read/delete routes in `http-server.ts`. Public routes use a public v1
   format key, strict allowlist validation, bounded body size, and the store;
   they do not authenticate a bearer or construct `RelayService`. Primary proof:
   `relay.integration.test.ts` through the real listener with only GitHub
   mocked. Fault injection covers write failure, response loss after commit,
   wrong key, global limiting across IDs, and no tracker write.
4. Add config-preserving project UUID creation plus a Claude-specific thin
   completion adapter around a shared public-envelope
   builder. It creates request UUIDv4 before payload construction, normalizes a
   remote, collects allowlisted provenance for at most 50 ms, and waits only for
   the remainder of the 500 ms total deadline. Missing remote skips quietly.
   Primary proof: CLI integration tests using temporary project config and Git
   metadata; supporting units cover canonical serialization, field allowlist,
   actor precedence, malformed profile input, and composed deadline arithmetic.
5. Add no Codex or Cursor adapter. They remain `skip: live receipt proof
   outstanding`; each needs its own spike before a thin adapter is added.
6. Update `README.md`, website docs, and `packages/retro-relay/README.md` with
   zero-signup UUID behavior, claimed metadata, public-key non-authentication,
   queue/operator lifecycle, quiet failure, and the fact this cannot file an
   issue or advance #1479/`05PR3F`/#834.

The prior Railway spike is input evidence only. It did not prove a cloud
carrier, so it does not enable one.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Store boundary | Separate `public_quarantine` store/table | Reuse `retro_requests`; external telemetry system | The former risks a filing path from public input; the latter adds a service without low-volume value. |
| Dedupe equality | Canonical sorted-key fingerprint of every validated v1 public field | Raw request bytes; fingerprint only retro text | Raw bytes make key order relevant; partial fingerprint allows changed persisted metadata under one receipt. |
| Timing | 50 ms profile collection inside one 500 ms total deadline | Additive 50 ms + 500 ms timers | Additive timers violate the silent handoff contract. |
| Admission and recovery | Global in-memory limiter, 10,000-record cap, 80%/full alerts, explicit operator delete | Public UUID as credential; automatic expiry/eviction | UUID is forgeable; automatic loss conflicts with "store it for later." This is low-volume operational containment, not abuse prevention. |
| Carrier rollout | Claude-only adapter after a live Claude carrier spike; each other provider separately | Shared hypothetical adapter now | An unused generic hook would misstate readiness and create contract drift. |

Figure It Out evidence: Node documents `DatabaseSync` as a synchronous,
single-connection API and supports prepared statements/transactions; this
matches the relay's existing WAL + `BEGIN IMMEDIATE` design. The existing
`PayloadKeyring` already encrypts with AES-256-GCM and binds a scope/hash as
associated data, so public records reuse it rather than introduce new key
management. See [Node SQLite docs](https://nodejs.org/api/sqlite.html).

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Structure enforces; instructions suggest | Public HTTP routes depend only on `PublicQuarantineStore`; no public method accepts a filing principal or calls `RelayService`. | Real-listener tests prove no GitHub call on every public outcome. | Explicit conflict: public route is deployment-enabled only after the Claude live-receipt gate, while architecture defaults it compiled off. |
| Add, never replace | Add a sibling table and config field; leave private credential filing and `retro_requests` unchanged. | Private-path regression integration test; reinstall preserves existing UUID. | |
| Optimize for the NTB without constraining the TBU | Builder sees no transport text; operators retain direct list/read/delete control. | Claude carrier wiring tests after hosted proof, plus operator-route tests. | |
| Clarity before correctness | One v1 allowlist, one quarantine key, and no unproven carrier abstraction. | Schema tests reject unknown fields; design doc and route contract stay small. | |

Architecture decision honored: `ARCHITECTURE.md`'s public-cloud-retro ADR keeps
public records outside the filing worker, on the existing encrypted one-replica
SQLite deployment.

## Known deviations

The architecture says public relay routing is compiled off pending readiness.
This plan enables only a deployment-configured quarantine route, not a private
filing path. It conflicts with the compiled-off default until the Claude spike
produces a live receipt; it still cannot satisfy #1479's authenticated durable
filing invariant or supersede #834.

## Doc impact

- `README.md`: plain-language zero-signup and privacy note.
- `packages/website/src/content/docs`: installation and public-retro lifecycle.
- `packages/retro-relay/README.md`: enablement, non-secret key, operator export/
  delete process, capacity alert, and disabled carrier status.

## Assessment triggers

- Claude spike invalidates its completion carrier: stop the Claude slice and
  preserve only the non-routed receiver work for a later carrier decision.
- Another provider proves a completion carrier: run its own spike before adding
  that provider's adapter and live receipt proof.
- Capacity alert or sustained global throttling: introduce edge admission/WAF;
  do not mistake the UUID or public key for abuse resistance.
- Second replica, region, or shared storage: replace the single-file queue with
  a transactional shared store before enabling public ingress.
- A new v1 field or key rotation: publish an explicit version/overlap migration
  rather than changing the accepted shape silently.
