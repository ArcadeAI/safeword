# Impl Plan: Preserve supported local retros through public quarantine

**Status:** planned
**Planned on:** 2026-08-23

## Approach

The riskiest assumption is that one cold direct HTTPS submission, real SQLite
WAL commit on the mounted Railway volume, response validation, and local receipt
write can finish inside the exclusive 2000 ms handoff budget. The proving
scenario is **“Work within both budgets is preserved”**, backed by a live
installed-client submission to the production-shaped collector. If that proof
misses either deadline, reopen the timing contract instead of hiding work in a
queue or background process.

Build the smallest end-to-end path in six TDD steps:

1. **Prove the real storage and network seam.** Add the private workspace
   package `packages/retro-collector` with a Node HTTP composition root and a
   narrow `node:sqlite` store. Run one instance, one process lock, WAL mode, and
   one Railway volume mounted at `/data`. Implement only credentialless
   `POST /v1/public-retros`: reject query strings and any `Authorization`,
   `Cookie`, or `X-Api-Key` header by presence, stream and reject as soon as byte
   65,537 arrives (never truncate), validate the complete closed v1 shape and
   duplicate keys, and transactionally store the exact raw BLOB under request
   UUID and session-scope uniqueness. Only the same request UUID with exact
   bytes returns the original receipt; conflicting bytes or a fresh UUID reusing
   any accepted scope rejects. Deploy this same package on a disposable dark
   volume that will never be promoted to production. Carry forward a minimal
   direct TypeScript client that sends a valid 65,536-byte fixture with the
   final headers, fixed origin, redirect/proxy behavior, and local receipt write.
   Run 20 cold DNS/TLS/POST samples locally, then 20-sample real-path batches
   across increasing measured RTTs. Every sample must finish below 1800 ms,
   leaving 200 ms contract margin; the highest all-pass RTT batch becomes the
   measured launch envelope rather than a preselected promise. Repeat 20 request pairs concurrently and
   require both requests in every pair below 1800 ms. This proves the complete
   client-to-volume handoff before the full profile or install surface. Exercise
   the exact final credentialless request and middleware. The short-lived dark
   endpoint is internet-reachable but unadvertised; destroy it and its volume
   after the proof instead of changing the final request with test credentials.

   Prove concurrent-arrival outcomes through the real HTTP server and its one
   production SQLite connection. Synchronous transactions serialize on the
   event loop before another handler can write, after which request/scope
   constraints return the converged receipt or conflict. Do not add a
   multi-connection busy/retry path for a topology v1 forbids; multi-process
   operation triggers the planned PostgreSQL migration instead.

2. **Build one direct TypeScript delivery stage.** Add a small module beside the
   existing retro pipeline that consumes exactly one extracted candidate.
   Extract one reusable `prepareFinding` primitive from `prepareEncounters` so
   private filing and public collection share the same normalize, surface, and
   sanitizer walls. The public envelope's string `finding` is a deterministic
   rendering of every field in that sanitized `Finding` (title followed by the
   existing `assembleBody` rendering); it does not introduce a second extraction
   schema or sanitizer. Expose one delivery orchestrator and
   keep preparation/building and claim/handoff as cohesive internal operations.
   Inject only real nondeterministic boundaries (monotonic clock, UUID source,
   and transport), never generic preparation callbacks that could let tests pass
   while production candidate-to-receipt wiring is broken.
   "Synchronous" at the product boundary means inline and awaited, never
   detached, not that every internal API is synchronous. Inside the 1000 ms
   preparation budget it validates the candidate structure, invokes
   the existing sanitizer and its authoritative pre-transmission validator,
   rejects empty/contaminated output and any forbidden or unknown source key,
   collects the closed source profile, lowercases a valid project UUID while
   deriving the harness-namespaced session scope, serializes canonical bytes,
   rejects byte 65,537, and obtains one request identity from an injected UUID
   source whose production implementation calls `crypto.randomUUID()`.
   Only after that complete request exists does it atomically claim
   `.safeword/retro-attempts/<scope>.json`, POSTs directly to the compiled HTTPS
   origin with redirects and proxy discovery disabled, validates the echoed
   identity/receipt, and atomically replaces the claim with the receipt. The
   production build compiles one immutable origin; integration tests compile a
   test-only build whose sole origin is the real local collector, never a
   runtime config or environment override. Use an
   injected monotonic clock, UUID source, and transport at this module boundary.
   Accept canonical lowercase UUIDs independent of UUID version. Enforce
   exclusive absolute 1000 ms preparation and 2000 ms handoff deadlines. An
   `AbortController` closes an in-flight HTTPS request and the stage awaits its
   termination before returning. Receipt persistence uses an abortable
   same-directory temp write, checks the deadline before issuing irreversible
   receipt persistence and before fsync/rename, and never
   renames after expiry; ignored temp files are not valid markers. Await cleanup
   so no socket, write, timer, or queued work survives hook exit. Never retry,
   detach, spawn, or narrate failure.

   Claim timing is asymmetric and synchronous: admit exclusive-create only
   while measured worst-case local claim headroom remains; otherwise create
   nothing. Once issued, `openSync('wx')`/write/fsync/close leaves no pending
   promise and is never rolled back; start no handoff if the clock is at the
   boundary when it completes. The sanitizer is side-effect-free and awaited rather than raced against an
   orphaning timer; check the absolute deadline after each bounded sanitizer or
   file-read stage. The 800 ms worst-case gate below makes that cooperative
   boundary feasible.

   The existing `prepareEncounters` sanitizer is async but process-free; its
   secretlint work is included here. Source collection adds no subprocess.
   Implement one bounded file reader for the repository `.git/config`, following
   `.git` gitdir pointers and `commondir` for linked worktrees (submodules use the
   same pointer resolution), and
   Git's user config files: `$GIT_CONFIG_GLOBAL` when set, otherwise
   `$XDG_CONFIG_HOME/git/config` or its standard fallback plus `~/.gitconfig`.
   Repository email wins over global; later global values win. If a consulted
   file uses `include` or `includeIf`, omit Git email instead of following
   arbitrary paths. Parse only origin URL and email, not general Git semantics.
   Before step 3, benchmark 20 cold-cache maximum-profile preparations including
   sanitizer, file reader, serialization, and atomic claim on macOS, Linux, and
   Windows CI; every sample must finish below 800 ms, leaving 200 ms margin.
   The runtime-identity dependency is explicit for hosts that can provide a
   verified GitHub login without network or credentials. Neither enabled local
   host currently can, so production returns unavailable and uses Git email
   precedence; tests inject it to pin future-safe ordering.

   Then rerun the same local and RTT-ladder samples and 20 concurrent pairs with the full
   shipped delivery stage, maximum envelope, echoed-identity validation, and
   durable receipt path. These all-pass gates occur before step 3.

3. **Install project state and the user escape hatch.** Reconcile the project
   config with a locally generated canonical `projectUUID` and optional
   `publicRetrospectiveCollection`; absent means enabled. Add
   `safeword project public-retros off|on` as a local-only mutation with clear
   success/error exits. Preserve UUID and explicit collection state across
   reinstall/upgrade. Register `.safeword/retro-attempts/` and its managed inner
   `.gitignore` in `schema.ts`, using the project-UUID and marker contracts
   already exercised through fixtures in step 2. Reconcile exactly one completion entry for
   each selected supported local harness. Reject a malformed collection setting.
   For it or an unreadable/malformed selected harness config—including the
   second harness in a two-harness install—leave the whole project tree
   unchanged, exit nonzero, and report an actionable error.

4. **Wire real Claude Code and Codex lifecycle collaborators.** Call the shared
   stage from the existing completion path after `prepareEncounters`. Zero or
   multiple candidates continue through the existing private/spool handling but
   make no public attempt. The installed entrypoint supplies the closed harness
   literal; payload metadata cannot. Add real-handler tests plus transport,
   timeout, redirect, receipt-write, concurrent-claim, malformed-marker, and
   post-exit byte fault injection. For each harness, one real-collaborator test
   uses the compile-time-only test origin and proves installed entrypoint → POST
   `/v1/public-retros` → real collector → durable local receipt. Extend the hook's existing single transcript
   parse to compute a separate public eligibility bit before extraction handoff
   and therefore before the delivery clock: count
   completed invocation/result pairs rather than raw tool-use entries, reject a
   missing/empty/whitespace stable session identifier, and allow a later run to
   become eligible. Existing private trigger predicate/extraction remains unchanged; the
   public eligibility bit only controls candidate handoff to public delivery.
   This closes the real install → hook → builder → collector
   walking skeleton; no earlier step claims installed wiring.

   Integration detail: start the public preparation clock immediately after
   extraction, then reuse the exact sanitized finding returned by the existing
   pipeline alongside its private encounter. Public delivery receives that
   prepared finding and the original absolute deadline. This keeps extraction
   outside the budget, sanitizer work inside it, and one sanitizer result
   authoritative for both paths without a generic callback seam or a second
   scrub pass.

5. **Complete quarantine reads.** Keep step 1's single `BEGIN IMMEDIATE`
   raw-body authority unchanged; never use parsed, reformatted, semantic, or
   sanitized MCP reads for duplicate decisions. Add operator-only receipt reads
   using one random server credential and enumeration-neutral responses.
   Authorized receipt reads return
   the byte-identical submitted body and receipt required by the contract. Do
   not add liveness, diagnostics, throttling, quotas, or retention routes. The collector package has no CLI or
   private-relay dependency and no access to private filing credentials or paths.

6. **Ship only after the real proof.** Finalize the collector Docker/Railway
   config used by the dark proof and pin one active replica, stop-before-start
   deploys, and a newly provisioned, empty production volume;
   destroy the separate dark volume after retaining only timing evidence. Prepare README/website
   disclosure of default-on collection, the exact allowlist, quarantine, opt-out,
   and absence of a v1 removal workflow in the unreleased change before compiling the HTTPS origin into
   shipped local handlers. Then make one installed-client live submission with
   a reserved, documented synthetic project UUID and acceptance-probe finding
   so operator reads can distinguish it from user data; require a durable local
   receipt inside both budgets. Update architecture
   docs, then run BDD, package, integration,
   full-suite, lint, typecheck, build, audit, verify, quality-review, and
   refactor gates.

   Publish that disclosure only with the feature release. A future removal
   request can be located by the opaque receipt retained in the local marker or
   by project UUID under operator authentication; v1 still exposes no delete.

## Launch critical path

Initial launch follows one strict sequence:

1. Complete the allowlisted local source collector.
2. Install and wire the shared TypeScript completion carrier for local Claude
   Code and local Codex.
3. Use the built-in HTTPS collector origin and retain the echoed durable receipt
   within the existing exclusive deadlines.
4. Prove installed hook → sanitized canonical bytes → public collector → SQLite
   durable acceptance → local receipt for both harnesses, including fault and
   concurrency cases.
5. Deploy the collector on its persistent Railway volume as one active replica,
   then pass the reserved synthetic live submission.
6. Publish the collection disclosure and run the complete release verification,
   audit, quality-review, and refactor gates.

The launch gate is step 4's installed end-to-end receipt proof. Retention,
deletion, quotas, and broader abuse controls remain follow-up operations and do
not block the initial release.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://www.sqlite.org/wal.html | 2026-08-23 | SQLite 3.53 documentation | SQLite 3.53.1 bundled by Node 24.18.1 | WAL is same-host only, permits one writer, and commits by appending a commit record | Keep one host and one writer; use FULL synchronization and retain the WAL beside the database | Official public-domain SQLite documentation; WAL is invalid on a network filesystem and multi-connection releases before 3.51.3 have a WAL-reset defect |
| https://nodejs.org/download/release/v24.18.1/docs/api/sqlite.html | 2026-08-23 | Node 24.18.1 | Node 24.18.1 | DatabaseSync is synchronous and provides a bounded busy timeout without a native addon | Keep the store synchronous and expose one narrow transaction boundary | Official Node documentation; node:sqlite is release-candidate stability, so the store contract owns upgrade risk |
| https://docs.railway.com/guides/rotate-credentials-zero-downtime | 2026-08-23 | Railway current docs | Railway hosted volume | A volume-backed service cannot overlap deployments and therefore has a small redeploy outage | Make the one-replica outage an explicit launch limitation instead of implying zero downtime | Official hosted-service documentation; behavior can change, so live deployment proof remains required |

**Decision impact:** retained: the sources confirm that a single-host SQLite WAL collector is the smallest durable launch shape, while requiring explicit same-host, supported-version, and deploy-gap boundaries.
**Decision informed:** Durable public store

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Durable public store | SQLite WAL on one Railway volume, one active process | PostgreSQL; memory | Current volume is small; SQLite is durable without another service. Migrate only when topology or contention requires it. |
| SQLite driver/runtime | `node:sqlite` on pinned Node 24.18.1, whose bundled SQLite 3.53.1 includes the WAL-reset fix | better-sqlite3; node-sqlite3 | Built-in storage avoids a native dependency. Upgrade behind store contract tests if its API changes; migrate if synchronous contention becomes material. |
| Duplicate authority | Persist and compare exact raw REST BLOBs under request/scope uniqueness | Sanitized MCP reads; reserialized JSON; similarity | Only received bytes can prove an exact retry. Similar findings from different sessions remain separate. |
| Request identity | One injected-source UUID generated by the shared builder and carried unchanged by either harness | Harness-specific IDs | Retry identity must not change with transport; validation is version-agnostic because project and request UUIDs may use different versions. |
| Session identity | SHA-256 of version, harness, project UUID, and stable host session ID | Similarity fingerprint | Harness namespace prevents cross-host collisions; similarity is not identity. |
| Client recovery | Claim once before one bounded attempt, with no automatic retry or queue | Receipt-before-claim; background queue; repeated hook retries | The user chose at most one outbound attempt per local session. Server uniqueness prevents two accepted records but cannot prevent concurrent or repeated failed network exposure before acceptance; the local claim can, at the explicit cost of post-claim loss. |
| Authentication | Credentialless public POST that rejects credential-bearing requests; separate server-held operator read credential | Embedded client key; private relay credential helpers | A shipped client secret is not secret. Public intake is isolated and operator reads remain authorized. |
| Collector boundary | Separate package, process, volume, and deployment | Public route inside the private relay | Structural absence keeps GitHub filing authority unreachable. |
| Identity lifecycle | Generate project UUID locally at install and preserve it | Signup; identity reset command | Zero registration is required; reset would invalidate dedupe markers. |
| Timing | Exclusive 1000 ms preparation plus exclusive 2000 ms handoff | 500 ms handoff; detached work | Live evidence disproved 500 ms for cold higher-latency paths; detached work is not reliable lifecycle completion. |
| Git metadata | Bounded direct reads of repository and user Git config; omit email on includes | `git` subprocess; full Git parser | The delivery stage forbids child processes, and the allowlist needs only origin URL and email precedence. |
| Collector observability | No collector diagnostics/liveness HTTP route in v1; manual Railway platform inspection | Authenticated diagnostics route | The canonical 97-scenario contract authorizes intake and operator record reads only. A diagnostics route adds an unreviewed authenticated surface; the low-volume launch accepts manual capacity/write-failure discovery. |
| Launch governance | Publish accurate notice with the feature; privacy/legal lifecycle review remains follow-up | Separate privacy/legal go/no-go gate | The user's 2026-08-23 decision explicitly superseded the earlier 2026-08-15 gate and kept retention, deletion, and separate privacy/legal review out of initial launch readiness. |
| Upgrade default | Missing collection setting enables silent collection after upgrade | Upgrade-time prompt; default-off migration | Zero-friction default-on behavior is the explicit product choice. Release disclosure and the local project opt-out preserve control, while the lack of active notice is an accepted NTB-transparency trade. |
| Client-stage boundary | One exported candidate-to-receipt orchestrator sharing `prepareFinding`; small internal build and handoff operations | One mixed-responsibility module; callback-driven generic executor | Sharing the sanitizer prevents policy drift, while injecting only clock/UUID/transport preserves real wiring in tests without a broad abstraction surface. |

The inherited private retry, tombstone, and ambiguous-create contract remains as
specified in `spec.md`. #834 is not superseded until the relay is deployed,
every real harness uses it, and GitHub-native fallback is retired. #1495 gates
readiness only if client credential helpers are reused; this plan does not reuse
them.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Collection is silent and bounded by default, while a local CLI opt-out and operator evidence remain available | deadline, opt-out, and operator-read scenarios | |
| 1. Structure enforces; instructions suggest | Public quarantine is a separate package, process, volume, and credential boundary with no private-filing dependency | package graph and real-collaborator no-call tests | |
| 3. Add, never replace | Install reconciliation preserves existing UUID, opt-out, and unrelated harness configuration | schema projection and reinstall matrix | |
| 5. Correct and safe; then clear; then simple | One shared builder and one small SQLite service replace per-harness transports and another managed database | Claude/Codex wiring tests plus live client-to-volume timing proof | |

Architecture record honored: `ARCHITECTURE.md` keeps CLI/template ownership in
`packages/cli`, generated state under `.safeword`, and hosted services in
independent packages. The collector adds a new independent package and the
install changes remain schema-driven.

## Known deviations

- Cloud, Cursor, and other hosts remain disabled; each needs its own live direct
  carrier proof.
- The public client claims before submission and has no retry queue. This limits
  each session to one outbound attempt but deliberately trades away recovery:
  a crash, deploy gap, timeout, or other failure after claim permanently loses
  that session's public retro even though server-side uniqueness would safely
  reject a second accepted record.
- Railway volume deployments cannot overlap, so each deploy or restart has a
  short known intake outage. The launch service has one durable copy and manual
  operator reads, not automated backup or alerting; those are operational
  follow-ups rather than initial-launch guarantees.
- Retention, deletion, throttling, quotas, and automated volume management are
  follow-up operations, not initial launch gates.
- Local attempt markers and any deadline-abandoned receipt temp files accumulate
  for the project lifetime; temp files are never treated as valid markers.
- Opt-out is project-scoped by explicit product decision; an unrelated new
  project defaults on until changed locally.
- Git configs using `include`/`includeIf` omit optional Git email rather than
  following arbitrary files or risking incorrect precedence.
- The documented runtime GitHub-identity tier is unavailable on both enabled
  local hosts without network or credentials. Production falls back to Git
  email; injection proves the precedence contract for a future carrier.
- The public collector quarantines records; it does not file GitHub issues.
- V1 exposes no collector diagnostics or liveness route. Capacity and write
  failures require manual Railway platform inspection; this operational blind
  spot is accepted for the low-volume launch rather than adding an unscoped
  authenticated surface.
- The user's later product decision makes separate privacy/legal lifecycle
  review a follow-up, not a production-readiness gate. Release disclosure must
  still state the transmitted allowlist, default-on upgrade behavior, durable
  quarantine, opt-out, and absence of a v1 removal workflow.
- Session-scope resistance assumes host-issued local session identifiers are
  not practically predictable. The contract only requires a non-empty stable
  identifier, so live readiness must inspect both enabled hosts' actual values;
  a predictable format blocks that harness until the identity design changes.
- The launch envelope supports only the highest measured RTT batch whose 20
  cold production-shaped samples all pass below 1800 ms. Higher-latency
  geographies and future database sizes are unsupported until remeasured.
- Shipped clients are pinned to one stable DNS name. That name must outlive any
  collector move or sunset because redirects and runtime overrides stay disabled.

## Doc impact

- `README.md` and website docs: default-on silent collection, exact allowlist,
  project opt-out, bounded silent failure, durable quarantine, and no v1 removal
  workflow.
- `ARCHITECTURE.md`: separate collector boundary, raw-body authority, SQLite
  topology, authentication model, and migration triggers.
- `packages/retro-collector/README.md`: endpoint, Railway volume, operator read,
  backup/manual inspection, and single-replica operation.
- `.project/surfaces.md`: confirm the public collector and both local harness
  lifecycle surfaces.

## Assessment triggers

- More than one active collector process, a network filesystem, or observed
  SQLite contention triggers PostgreSQL migration behind the store boundary.
- Automatic retry requires a separately reviewed durable client queue.
- Public-to-private filing, caller authentication, or broader metadata requires
  a new threat model and contract review.
- A host is enabled only after its shipped lifecycle carrier produces a live
  durable receipt within the approved budgets.
- A supported host whose real session identifiers are predictable is not
  enabled on the credentialless collector until scope-squatting is mitigated.
- A collector hostname change uses DNS cutover at the stable compiled name; a
  sunset must keep that name answering quickly for supported older clients.
- Material database growth or a handoff-latency regression triggers
  timing/capacity review.
