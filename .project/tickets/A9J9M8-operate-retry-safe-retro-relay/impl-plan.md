# Impl Plan: Deliver retry-safe retro findings across every harness

**Status:** planned

## Approach

The riskiest boundary is local crash consistency: exact bytes must survive
concurrent persistence, claim expiry, lost responses, and crashes around ack
without a second GitHub-native create. The cheapest decisive proof uses a
separate immutable file per relay request and drives every filesystem boundary
through the real shared CLI entry point.

Proof plan and build order:

1. **Immutable relay spool and fenced claims (integration + fault injection).**
   Add CLI-owned per-request files whose contents are the exact serialized HTTP
   bytes. Atomically persist, claim by rename, rearm expired claims, condition
   every ack/release/delete on the owned claim filename, and treat an atomic ack
   file as authoritative before idempotent payload cleanup. Inject crashes and
   stale-owner returns at every mutation boundary. Prove concurrent persist and
   drain cannot overwrite one another.
2. **Bounded shared relay handoff (real-collaborator wiring).** Add the CLI-owned
   relay HTTP client and place routing behind a repository-controlled readiness
   manifest compiled disabled in this slice; environment variables cannot
   override it. Run the real command core, real spool, real
   relay HTTP server, auth, encryption, and SQLite; mock only GitHub network and
   the one deliberately nonresponsive relay socket. Use a 750ms monotonic
   network deadline and prove the operation exits within one second. Table-drive
   Claude, Claude Cloud, Codex, Codex Cloud, Cursor, and Cursor Cloud through
   the same entry point using an internal injected-ready seam. Validate the
   versioned manifest, exact upstream issue identity, landed-commit ancestry,
   artifact blob hashes at an evidence commit, evidence-to-build ancestry, and
   30-day freshness. Embed the build Git commit into the CLI rather than reading
   runtime environment. Prove valid injected evidence selects relay; malformed, stale,
   closed-but-unlanded, wrong-repository, or other-build evidence selects native;
   the public disabled manifest cannot contact relay; and a lost relay response
   never invokes native fallback.
3. **Multi-principal production startup (runtime integration).** Parse a strict
   credential array, require Claude/Codex/Cursor `file` principals and an
   operator with only `reconcile`/`operate`, then prove rotation/repository/
   operator boundaries through the real HTTP server. Reject single-principal
   variables in production. Accept them only under explicit `RELAY_MODE=spike`,
   whose server exposes health only and rejects every filing/status/reconcile/
   operations request before auth, storage, or GitHub.
4. **Lifecycle maintenance (store integration).** Migrate a real version-1
   database to version 2 in one version-last transaction, inject a failure at
   every migration step, and reject partial/newer layouts before listen. Drive
   exact 24h/25h/30d boundaries with an injected clock and durable exponential
   retry scheduling. Race every deadline CAS, including no dispatch at 24h and
   known-issue adoption versus ambiguity at 25h. Reopen between sweeps and prove
   dead letters, ambiguity, application-inaccessible envelope compaction,
   indefinite identity/evidence, mismatch rejection, and one durable outbox row
   per terminal event.
5. **Operations and secret opacity (HTTP + process boundaries).** Exercise the
   authenticated operations route against real mixed-state SQLite data. Run
   classic and stateless installation-token examples through the real GitHub
   collaborator with only its HTTP boundary mocked; scan child argv and its
   minimal environment plus responses, durable files, logs, and metrics for
   configured secrets. Deliver outbox alerts at least once with a stable event
   ID and inject crashes before and after logger delivery.
6. **Regression and docs.** Run the inherited
   `retry-safe-retro-filing.feature` suite unchanged and update
   `ARCHITECTURE.md` plus relay/CLI docs. Do not route the live Railway spike to
   production GitHub or claim #834 superseded.

Every affected harness surface is an example in the shared-entry-point
scenario. Cloud variants use the same installed CLI command; the wiring proof
asserts their real hook/config surface resolves that command before invoking
the common core.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Client request identity | UUIDv4 at first persistence; exact stored bytes thereafter | signature/canonical hash; regenerate per attempt | Semantic evidence drifts and is public meaning; regeneration breaks cross-harness mismatch rules |
| Cross-session ownership | Immutable payload renamed to a claim-ID/expiry filename | shared JSONL rewrite; advisory in-memory lock; client SQLite | Shared rewrites lose concurrent appends; memory does not cross processes; client SQLite is unnecessary deployment weight |
| Local commit | Atomic ack journal is authoritative; payload deletion is recoverable compaction | “atomic” ack plus delete; delete then ack | Two mutations cannot be atomic without a journal; delete-first loses retry evidence |
| Session latency | 750ms network abort inside one-second operation budget; no receipt means no ack | wait for filing; fire-and-forget; immediate GitHub fallback | Stop hooks must return; fire-and-forget cannot prove acceptance; fallback after response loss can duplicate |
| Runtime credentials | Strict base64 JSON array in production; explicit non-ready spike mode for the legacy credential | one shared production credential; one env variable set per harness field | Shared credentials prevent independent rotation/audit; spike compatibility cannot weaken production |
| Lifecycle storage | Additive version-2 schedule/timestamps, version-last transaction, retained semantic evidence | destructive table rewrite; delete evidence; PostgreSQL now | Rewrite risks the live database; evidence deletion changes uniqueness; PostgreSQL exceeds the proven topology |
| Payload retention | Application/API inaccessibility after 30d, with checkpoint requested | forensic secure deletion; indefinite API access | Secure deletion requires external per-record key management and backup controls outside this slice; indefinite access violates the body |
| Maintenance | Idempotent DB sweeps, transactional outbox, stable alert event IDs | trusted timers per request; exactly-once logger writes | Timers vanish on restart; external logging cannot be exactly once across crash windows |
| Operations | Authenticated JSON summary and structured alerts | public metrics with request labels; dashboard UI | Public metrics expand exposure; a UI is not needed to make state machine-readable |

Evidence:

- Canonical #1479 body defines the 24-hour retry deadline, 1-hour grace,
  30-day payload retention, indefinite tombstones, and prerequisite gate.
- The Railway spike proved one process plus one `/data` SQLite volume survives
  process replacement.
- Existing N30CKR integration tests prove the real HTTP/auth/encryption/SQLite
  composition while mocking only GitHub HTTP.

## Arch alignment

- Honors `ARCHITECTURE.md` single-process SQLite WAL topology and PostgreSQL
  trigger.
- Preserves raw REST bodies as the only marker authority; MCP is absent from
  the filing decision interface.
- Keeps harness identity as audit/authz metadata, never request identity.
- Keeps server-held GitHub App tokens outside clients and durable state.
- Keeps the new relay spool in CLI source so the existing template JSONL spool
  and filing-gate semantics remain untouched.

## Known deviations

- The existing foundation was implemented before the canonical body added
  #1474/#1481 as blocking prerequisites. Runtime relay selection is therefore
  fail-closed until closed-issue and measurement evidence is supplied; this
  branch cannot send live traffic through the foundation.
- SQLite pages, WAL history, Railway snapshots, and operator backups are outside
  the 30-day application-access retention promise. This slice does not claim
  forensic secure deletion.
- A local spool cannot survive reclamation of an ephemeral cloud VM when the
  relay is unreachable. The one-second fallback is visible and safe for the
  remaining process lifetime, while cross-runtime durability still depends on
  relay acceptance.

## Doc impact

- Update `packages/retro-relay/README.md` with multi-principal configuration,
  maintenance, and operations.
- Update `ARCHITECTURE.md` with client claim ownership and executed lifecycle.
- Update the applicable CLI/website retro documentation only to describe
  gated relay variables and fallback behavior; do not advertise general
  availability or uniqueness completion.

## Assessment triggers

- More than one relay process, NFS, or sustained SQLite contention → PostgreSQL.
- Handoff timeouts at the one-second budget → accept-only queue endpoint.
- Repeated stale client claims → standalone delivery worker.
- Reusing CLI GitHub credential helpers → #1495 readiness gate.
- #1474/#1481 closure and post-fix measurements → separate uniqueness rollout
  review, never implicit promotion by this ticket.
