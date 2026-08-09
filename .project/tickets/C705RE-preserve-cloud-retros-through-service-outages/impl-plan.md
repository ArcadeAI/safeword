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
   normalized repository, and request ID; it retains encrypted payload/profile
   for 30 days and then a payload-free tombstone indefinitely. Its API rejects
   a reused identity with a changed payload and never exposes read, operate, or
   filing methods. Primary proof: `packages/retro-relay/tests/lifecycle.test.ts`
   integration tests using a real temporary SQLite database. Supporting proof:
   migration/restart and clock-controlled retention tests.
2. Add the disabled-by-default public route in `http-server.ts`. It validates a
   bounded schema, applies a small in-process global and namespace rate limit,
   commits before returning a request-bound receipt, and has no status/read
   route. Primary proof: `packages/retro-relay/tests/relay.integration.test.ts`
   through the real HTTP listener, mocking only the GitHub process boundary.
   Fault injection covers persistence failure and response loss after commit.
3. Add a shared CLI cloud-intake builder: create one UUIDv4
   `projectInstallationId` during `safeword install` while preserving every
   other config key; derive a normalized remote, profile, and one existing
   transport-independent request ID; enforce a 50 ms profile budget; and submit
   a single 500 ms fire-and-forget attempt. `GITHUB_ACTOR` wins over local Git
   email; no source causes a network identity lookup, token read, hostname, or
   local-path transmission. Primary proof: CLI integration tests with real
   temporary project config and Git metadata, faking only fetch/subprocess
   boundaries. Supporting unit tests cover URL normalization, source precedence,
   redaction, timeout, and malformed input.
4. Wire the shared builder into the cloud-carrier adapter seam but keep all
   three provider routes disabled until a provider-specific carrier probe has a
   real hosted completion signal and receipt. Primary proof: adapter wiring
   tests with the real installed config and public HTTP fixture; provider live
   checks remain release evidence, not mocked acceptance. This covers Claude
   Code Cloud, OpenAI Codex Cloud, and Cursor Cloud Agents without claiming
   present availability.
5. Update the relay README plus user install/privacy documentation in `README.md`
   and `packages/website/src/content/docs/`: explain local public UUID creation,
   best-effort metadata, 30-day encrypted retention, and the fact that this
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
| Durable public data | Separate `public_quarantine` table, store API, and lifecycle | Reuse `retro_requests`; external telemetry vendor | Reuse would give anonymous intake a path toward filing semantics; an external store adds an unnecessary data system. |
| Public API | Disabled-by-default, write-only `POST /v1/public-retros` with bounded global/namespace limiting | Bearer credential in plugin; public access to existing filing route | Marketplace code cannot protect a bearer; existing route is privileged by design. |
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
| Clarity before correctness | One public route, one receipt vocabulary, and no public read API make the trust boundary legible. | Route-contract integration tests reject privileged paths and invalid bodies. | |

Architecture record honored: `ARCHITECTURE.md`'s Retro relay boundary retains
one Railway replica, one persistent `/data` volume, encrypted envelopes, and
server-side GitHub credentials. This plan adds a sibling quarantine boundary;
it does not relax authenticated filing.

## Known deviations

The current architecture says public relay routing is compiled off until
readiness evidence exists. This plan permits only a disabled-by-default public
quarantine endpoint; it cannot file, reconcile, read records, enable `05PR3F`,
or affect issue 834. The explicit separation is recorded below rather than
treating public receipt as authenticated relay activation.

## Doc impact

- `README.md`: add a plain-language privacy/zero-signup note near install and
  retain the distinction from ordinary private filing.
- `packages/website/src/content/docs`: add the same user-facing explanation and
  retention statement.
- `packages/retro-relay/README.md`: document the public route's opt-in server
  setting, encryption/retention, no-filing guarantee, and live-carrier probe.

## Assessment triggers

- More than one replica, a network filesystem, or a second relay region: move
  the durable public store to an appropriate shared database before enabling it.
- A public route needs reads, operations, or GitHub writes: require an
  independently rotatable authorization design and reconsider the boundary.
- A provider proves a real completion carrier: add that provider's adapter and
  record its hosted receipt/timing evidence before enabling it.
- Sustained abuse or rate-limit pressure: add an edge/WAF control rather than
  trusting the public UUID as a credential.
