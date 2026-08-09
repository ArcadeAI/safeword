# Impl Plan: Preserve cloud retros through service outages

**Status:** planned

## Approach

The riskiest assumption is that anonymous intake can commit an encrypted
quarantine record without ever entering the authenticated GitHub filing state
machine. Prove that first with a real HTTP server, SQLite store, and payload
keyring: a successful `POST /v1/public-retros` returns one receipt, survives a
restart, and leaves the GitHub fixture untouched.

1. Add a versioned `public_quarantine` SQLite table and store API beside, but
   separate from, `retro_requests`. Its primary key is public project ID,
   normalized repository, and request ID; the queue has a configurable maximum
   record count (10,000 by default), retains accepted encrypted
   payload/profile, and never evicts a record to accept another. Its API
   returns the original receipt for the same raw payload, rejects a changed
   payload under the same identity, and atomically makes concurrent duplicates
   one record. Primary proof: `packages/retro-relay/tests/lifecycle.test.ts`
   integration tests using a real temporary SQLite database, including restart,
   exact-capacity, 80%-fill alert, same-key concurrency, and distinct-key
   final-slot races. Reuse the existing `PayloadKeyring` envelope format for
   encryption at rest and operator decryption; keys remain server-only relay
   configuration, as for private filings.
2. Add an explicitly deployment-enabled public route in `http-server.ts`. It
   validates the release-scoped public ingest key and a bounded schema, applies
   simple global and namespace rate limits, checks capacity inside the write
   transaction, commits before returning a request-bound receipt, and exposes
   no public read/status route. Add authenticated operator-only paginated list,
   receipt lookup, and explicit receipt-delete routes for queued records;
   operator list/lookup is the export surface and delete requires the operator
   to have already selected the exact receipt. None can file or reconcile.
   Primary proof: `packages/retro-relay/tests/relay.integration.test.ts`
   through the real HTTP listener, mocking only the GitHub process boundary.
   Fault injection covers persistence failure, response loss after commit,
   unrecognized-key and configured-rate-limit rejection, dedupe before rate
   limiting, 80%-fill alert, full-queue rejection, and a reachable endpoint
   whose response crosses the deterministic deadline.
3. Add a shared CLI cloud-intake builder: create one UUIDv4
   `projectInstallationId` during `safeword install` only when missing while preserving every
   other config key; derive a normalized remote, profile, and one
   transport-independent UUIDv4 request ID before payload construction; enforce
   a 50 ms profile budget using an injected monotonic clock in tests; and submit
   a bounded receipt request using only the remainder of the 500 ms total
   deadline. `GITHUB_ACTOR` wins over local Git
   email; no source causes a network identity lookup, token read, hostname, or
   local-path transmission. Primary proof: CLI integration tests with real
   temporary project config and Git metadata, faking only fetch/subprocess
   boundaries. Supporting unit tests cover URL normalization, source precedence,
   redaction, deterministic composed deadline, malformed input, egress field
   exclusion, install idempotency, and missing-remote quiet skip.
4. Wire the shared builder into the cloud-carrier adapter seam but keep all
   three provider routes disabled until a provider-specific carrier probe has a
   real hosted completion signal and receipt. Primary proof: adapter wiring
   tests with the real installed config and public HTTP fixture; provider live
   checks remain release evidence, not mocked acceptance. This covers Claude
   Code Cloud, OpenAI Codex Cloud, and Cursor Cloud Agents without claiming
   present availability.
5. Update the relay README plus user install/privacy documentation in `README.md`
   and `packages/website/src/content/docs/`: explain local public UUID creation,
   best-effort metadata, bounded encrypted operator-queue retention, and the fact that this
   route never files an issue or replaces the private relay. Update the Railway
   deployment/runbook with the explicit public-ingress enablement and the
   per-provider live probe.

The spike evidence is intentionally part of this plan: Railway `GET /health`
returned 200 in 286 ms and a bounded unauthenticated POST reached the service
in 213 ms but returned the expected 401. The production endpoint therefore
must be added before any actual carrier can be tested. Sources: [Node SQLite
API](https://nodejs.org/download/release/v23.11.1/docs/api/sqlite.html) and
[Railway persistent volumes](https://docs.railway.com/overview/the-basics).

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Durable public data | Separate bounded `public_quarantine` operator queue, store API, and lifecycle | Reuse `retro_requests`; external telemetry vendor | Reuse would give anonymous intake a path toward filing semantics; an external store adds an unnecessary data system. |
| Public API | Deployment-enabled `POST /v1/public-retros` with public format key, bounded global/namespace limiting, and operator-only list/lookup | Bearer credential in plugin; public access to existing filing route | Marketplace code cannot protect a bearer; existing route is privileged by design. |
| Public identity | Locally generated UUIDv4 in `.safeword/config.json` at `projectInstallationId` | Server enrollment; device/account identity | The UUID needs no sign-up and is not authority; network registration defeats the zero-friction requirement. |
| Profile source | One shared builder with `GITHUB_ACTOR` first, local Git email fallback, and a 50 ms budget | Per-harness collectors; GitHub/CLI identity lookup | Per-harness logic drifts; identity calls are slow, noisy, and can require credentials. |
| Carrier rollout | Shared adapter seam, all host routes disabled until live proof | Pretend a generic hook works everywhere; block feature until all hosts are proven | The first misstates readiness; the second prevents a useful safe server/client slice. |

Figure It Out evidence: Node's `DatabaseSync` is a single file-backed,
synchronous SQLite connection, matching the relay's existing single-process WAL
and transaction boundary. Railway documents persistent volumes as the storage
that survives deploys/restarts and distributes traffic among replicas, so this
design retains the existing one-replica volume rule. The isolated spike found a
live Railway health response but no public receipt route; its result was
`PARTIAL`, not carrier validation.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Install creates the ID silently; handoff adds no task narration while a TBU can inspect documented operational evidence. | CLI integration tests prove no network install and no output; adapter tests prove silent failure. | |
| Structure enforces; instructions suggest | Separate public table/service methods make public ingress unable to call the filing worker. | Real HTTP/store integration tests assert no GitHub request on every public path. | |
| Add, never replace | Config generation writes only a missing project ID and preserves unknown user keys. | Temporary-config wiring test reads the original keys after install. | |
| Clarity before correctness | One public submit route, one receipt vocabulary, and separately authenticated operator reads make the trust boundary legible. | Route-contract integration tests reject public reads, privileged paths, and invalid bodies. | |

Architecture record honored: `ARCHITECTURE.md`'s Retro relay boundary retains
one Railway replica, one persistent `/data` volume, encrypted envelopes, and
server-side GitHub credentials. This plan adds a sibling quarantine boundary;
it does not relax authenticated filing.

## Known deviations

The current architecture says public relay routing is compiled off until
readiness evidence exists. This plan permits only an explicitly
deployment-enabled public quarantine endpoint; it cannot file, reconcile,
enable `05PR3F`, or affect issue 834. Public reads remain impossible; only an
existing authenticated operator may list, inspect, export through the list API,
or explicitly delete one selected record to restore capacity. The explicit
separation is recorded below rather than treating public receipt as
authenticated relay activation.

## Doc impact

- `README.md`: add a plain-language privacy/zero-signup note near install and
  retain the distinction from ordinary private filing.
- `packages/website/src/content/docs`: add the same user-facing explanation and
  fixed-capacity retention statement.
- `packages/retro-relay/README.md`: document the public route's enablement,
  public-key boundary, fixed-capacity encrypted queue, operator access,
  no-filing guarantee, and live-carrier probe.

## Assessment triggers

- More than one replica, a network filesystem, or a second relay region: move
  the durable public store to an appropriate shared database before enabling it.
- A public route needs reads, operations, or GitHub writes: require an
  independently rotatable authorization design and reconsider the boundary.
- A provider proves a real completion carrier: add that provider's adapter and
  record its hosted receipt/timing evidence before enabling it.
- Sustained abuse, capacity, or rate-limit pressure: add an edge/WAF control
  or stronger client attestation. The public UUID is not an abuse-control
  credential; the initial global rate/cap merely buys the operator time to
  inspect/export/delete safely.
