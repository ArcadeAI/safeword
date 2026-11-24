# Monorepo Structure

The [generated package map](../architecture.generated.md) lists workspace packages, their responsibilities, and their dependencies. Native plugins are generated from canonical CLI templates. Claude skill verification tolerates YAML metadata reserialization while requiring exact body bytes. Other payloads retain byte-exact verification.

## CLI-side retrospective flow

1. **Extract.** At Stop, `templates/hooks/stop-retro.ts` runs once per substantial session, out of band, as `safeword retro run --auto-extract` (a headless child guarded against recursion). `src/retro` sanitizes, deduplicates, and triages findings, then spools sealed post-egress drafts.
2. **File.** `templates/hooks/stop-retro-filing.ts` emits one Stop `decision: "block"` continuation that asks the agent to dispatch the shipped `safeword-retro-filer` subagent with the spool path. The subagent files each draft upstream and drains the spool (ack file plus `drain-retro-spool.ts`). Each batch has an attempt limit, and the prompt reminds the agent to finish filing.
3. **Public collector route.** `src/retro/public-config.ts` enables it only when `.safeword/config.json` has a valid `projectUUID` and `publicRetrospectiveCollection` is not `false` (`safeword project public-retros on|off` toggles it). `src/commands/retro.ts` builds the public source and delivery.
4. **Relay route.** `src/commands/retro.ts` also connects to the relay through (`retro/relay-delivery.ts`, `retro/relay-readiness.ts`). The public CLI leaves that connection disabled while checked-in readiness evidence keeps relay routing off.

## Public retrospective collector boundary

> **Cutover status:** The queue, worker, and independent release verifier described
> below are present, but local clients remain on direct filing. The production
> server route is compiled fail-closed until the required protected canary and
> fault evidence exists.

`packages/retro-collector` accepts released canonical `v1` single-finding bodies,
canonical `v2` ordered finding batches, and server-owned `v3` local batches without
user registration or client credentials. Legacy `v1`/`v2` rows remain inert
quarantine. A `v3` row is keyed only by its transport-independent UUIDv4 request
identity and retains the admitted bytes, digest, acceptance time, project identity,
lease state, quota reservation, and terminal metadata in SQLite.

The collector validates each version's closed envelope and source schema and stores
the accepted raw body unchanged in SQLite. Legacy duplicate rules remain unchanged;
`v3` retries reuse a receipt only when the request UUID and exact bytes agree.
Routine inspection of the `v3` queue is payload-free. Its worker and break-glass
payload reads use separate credentials and append audit records; the inert legacy
quarantine retains its pre-existing operator-read compatibility route. Public
fields grant no read or filing authority. Rolling intake and filing quota windows persist across restarts;
quota-blocked work stays queued and reaches an alerted dead letter after 24 hours.

## Cutover-gated collector transfer worker boundary

The single-replica Railway worker has no public route and no customer credential.
It leases FIFO `v3` rows over private networking, forwards the original bytes,
collector digest and request UUID to the relay's dedicated
`collector-worker` principal, and completes collector ownership only after relay
acceptance. A failed handoff releases the lease. If the worker crashes, the lease expires. Collector SQLite remains mounted only by the collector service.

## Retro relay boundary

`packages/retro-relay` deploys separately from the published CLI.
Public relay routing remains compiled off until the readiness evidence below
is satisfied.

**Identity.** The gated shared CLI core sends the same
tenant/installation/repository/request-ID identity from every harness surface
(Claude, Codex, Cursor). Which harness or subject made the call is used only
for authorization and audit — it is never part of that identity.

**Storage.** SQLite WAL is the smallest supported durable store for one
active process on one host; multi-host deployment or a network filesystem
requires migrating through the store boundary to PostgreSQL. The relay uses
Node's built-in `node:sqlite` API, so contributors and deploys need no host
compiler or native-addon prerequisites. A separate SQLite lock database holds
one exclusive transaction for the life of the process — if the process
crashes, the operating system releases that lock automatically, with no PID
files or stale-lock cleanup needed.

**Deployment.** The Railway deployment profile fixes one replica and one
persistent `/data` volume. Readiness must query SQLite's schema version. A
random per-process boot ID proves that an in-place restart replaced the
process; `RAILWAY_REPLICA_ID` identifies the hosted replica but may stay
stable across a restart, so it cannot confirm that the process restarted.

**Payload handling.** The relay stores request payloads only as AES-256-GCM
envelopes and keeps GitHub App credentials server-side. When a create
request's outcome is ambiguous, the relay quarantines it until a privileged
reconciliation step finds exactly one reserved marker in a complete raw REST
issue-body scan — sanitized MCP reads are never duplicate authority. The
client supplies one absolute creation-plus-24-hour retry deadline, which the
server persists and may shorten but never extend. Collector-owned `v3` is the
exception: relay acceptance starts its fresh server-owned deadline, as recorded
under [Collector-to-relay ownership transfer](collector-to-relay-ownership-transfer.md).
Both paths then have one-hour dispatch grace, 30-day filed-payload retention,
and indefinite tombstones; the timed maintenance worker persists its retry
schedule and terminal alert outbox in the same database. With #1474 and #1481 complete, canonical/legacy
semantic adoption and cross-request aliasing remain unbuilt until the
post-fix collision rates are remeasured and bound into the readiness
evidence.

**Durability before transport.** The CLI persists the exact request bytes and UUID in an operator-provided outbox outside the workspace. Hosts can retry the same request when they share that outbox. Atomic claims and a durable acknowledgement journal protect interrupted sends. An ambiguous relay response cannot authorize a second filing through the native route.

**Production cutover.** Repository-scoped filing credentials and separate operator credentials bound relay authority. Release verification ties production measurements and immutable evidence to the running build. Until the protected canary, fault, and throughput checks pass, clients retain direct filing. The [relay operations guide](../../packages/retro-relay/README.md) describes deployment and recovery.
