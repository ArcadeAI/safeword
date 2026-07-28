# PR review resolution — round 3

## Quality Review

**Currency:** ✓ Node HTTP/SQLite, GitHub REST, Debian package, Docker build, and
HTTP problem-detail behavior checked against primary sources on 2026-07-28.

**Sources:** ✓ Each load-bearing decision below is tied to current primary
documentation or a reproduced state-machine path.

**Correct:** ✓ N1, N2, N3, N5, N7, and N8 are confirmed and assigned RED
coverage. N4 remains a required raw-authority conflict. N6 has no independent
guarantee under a partial restore and is outside the documented durability
boundary.

**Elegant:** ✓ Typed reasons, one confirmed discard command, external lock
ownership, and a lazy corruption-only reservation scan avoid new services or
indexes.

**No-bloat:** ✓ No new database, semantic dedupe layer, or secondary
acknowledgement ledger.

**Wiring:** ✓ The new discard command runs through the built Commander entry
point; recovery runs through real HTTP and durable filesystem collaborators;
runtime lock ordering runs through the real server, SQLite store, and lock.

**Verdict:** APPROVE AFTER VERIFICATION

**Critical issues:** N1, N2, N3, N5, N7, and N8 require the changes below.

**Suggested improvements:** Carry the cross-window semantic-dedupe mechanism
forward with R4; measure reservation count before adding an index.

**Provenance:**

- Node `server.close()` waits for the server close lifecycle, and the SQLite
  adapter exposes an explicit synchronous `close()`:
  https://nodejs.org/download/release/v22.15.0/docs/api/http.html and
  https://nodejs.org/download/release/v22.13.1/docs/api/sqlite.html
- RFC 9457 defines machine-readable problem types and extension members rather
  than clients parsing prose:
  https://datatracker.ietf.org/doc/html/rfc9457
- GitHub documents raw issue bodies and their editability:
  https://docs.github.com/en/rest/issues/issues
- Debian identifies Bookworm `gosu` as `1.14-1+b10`, and the Debian snapshot
  archive provides dated immutable repositories:
  https://packages.debian.org/bookworm/gosu and https://snapshot.debian.org/
- Docker documents that exact package versions are version pins and that
  `apt-get update` must share the install layer:
  https://docs.docker.com/build/building/best-practices/

**Next:** Run the focused RED/GREEN tests, full verification, audit, and a fresh
independent quality re-review.

## Figure It Out

- [x] Phase 1: Decide how to close each confirmed failure without weakening
      request identity, raw-body authority, or operator separation.
- [x] Phase 2: Compare typed vs prose errors, automatic vs explicit deletion,
      internal vs external lock ownership, mutable vs snapshot package sources,
      and retained vs indexed source tombstones.
- [x] Phase 3a: Enumerate API error semantics, crash-consistent outboxes,
      destructive CLI safety, failure-message UX, raw-marker authority,
      dedupe-ledger retention, backup/restore boundaries, container supply
      chains, and resource ownership.
- [x] Phase 3b: Research every named domain through the primary sources above
      and reproduce the code paths locally.
- [x] Phase 4: Debate and commit.

### N1 — deadline renewal

Options were (1) infer expiry from any 400, (2) parse error prose, or (3) use a
machine-readable reason. Recommend **3** because it is the only stable and
unambiguous contract. Renewal remains durable before the retry so an ambiguous
network outcome cannot leave the server holding bytes the outbox forgot; a
definitive 4xx rejection restores the original bytes.

**Premortem:** a future server adds another deadline error but forgets the
reason, so the client safely refuses renewal and leaves the original dead
letter visible.

**Next:** Add server/client tests for the typed reason, unrelated 400, renewed
4xx rollback, and same-source replay.

### N2 — ambiguous recovery

Options were (1) make ambiguity 2xx, (2) parse the structured 503 receipt, or
(3) add a new lookup round trip. Recommend **2** because ambiguity remains a
failure while the existing receipt and separate operator credential authorize
the explicit recovery path.

**Premortem:** malformed 503 bodies trigger recovery; mitigate by requiring the
exact request ID, receipt ID, and `ambiguous` state.

**Next:** Bridge a real ambiguous 503 to the operator recovery endpoint.

### N3 — failure reporting

Options were (1) keep fail-fast output, (2) render the durable summary before
the error, or (3) introduce structured logging. Recommend **2** because it
preserves the nonzero exit while exposing already-known recovery state.

**Premortem:** the failure path prints success; prevent it with an explicit
no-`retro complete` assertion.

**Next:** Render relay state first, terminal error last.

### N5 — poisoned spool

Options were (1) auto-delete, (2) overwrite/rearm corrupt bytes, or (3) add an
exact-ID confirmed discard. Recommend **3** because deletion is intentional,
bounded, and auditable by the shell invocation.

**Premortem:** an operator mistypes an ID; UUIDv4 validation plus exact
filesystem matching makes that a no-op.

**Next:** Add `retro-relay-discard <request-id> --confirm`.

### N4, N6, reservations, R4, and R8

Weakening raw evidence, deleting identity tombstones, duplicating a journal in
the same partially restored directory, or dropping payload keys would trade a
visible stop for silent duplicates or unrecoverable payloads. Keep the existing
contracts. Make reservation lookup lazy on the corruption path, document
whole-directory backup/restore, retain the R4 overlap mechanism as a separate
semantic-dedupe concern, and keep unresolved payload keys until recovery.

**Premortem:** tombstone count eventually affects latency; instrument and index
only after measurement instead of imposing retention that permits duplicates.

**Next:** Document the invariants and remove the normal-path reservation scan.

### N7 — gosu source

Options were (1) mutable archive with exact version, (2) unpinned package, or
(3) exact version from a dated Debian snapshot. Recommend **3** because it
preserves both the version and its availability with the smallest Dockerfile
change.

**Premortem:** the snapshot timestamp lacks the target architecture; the
multi-architecture container build is the release gate.

**Next:** Point the runtime apt source at a dated snapshot and build the image.

### N8 — shutdown ownership

Options were (1) keep server-owned release, (2) add callback ordering, or (3)
make the component that acquired the lock release it after closing its store.
Recommend **3** because ownership and teardown become symmetric.

**Premortem:** direct server callers leak internally acquired locks; retain
server release only for locks it acquires from `lockPath`.

**Next:** Distinguish owned and borrowed locks and prove the borrowed lock
survives server close.

## Fresh re-review — destructive-operation ownership

The post-fix quality loop reproduced one additional blocking race: discard
could delete an active delivery claim or a dead letter while its HTTP recovery
was in flight. A successful remote create would then lose its local
acknowledgement and permit the same source to receive a new request identity.

The figure-it-out options were (1) document that operators must avoid
concurrency, (2) check filenames before deletion, or (3) give delivery,
dead-letter recovery/rearm, and discard one atomic filesystem ownership
protocol. Recommend **3**. A check alone has a time-of-check/time-of-use gap;
atomic renames make exactly one operation the owner. Discard now acquires an
unclaimed primary and refuses any independently owned primary or recovery
claim. Recovery and rearm atomically rename the dead letter into a distinct,
expiring recovery claim. A crashed recovery claim returns to the dead-letter
queue after its lease.

**Premortem:** recovery crashes after claiming a dead letter. The expiring
recovery claim remains durable, is never treated as a normal active filing, and
is restored to the dead-letter name by spool recovery.

**Evidence:** deterministic paused-response tests prove discard refuses an
active primary delivery and an in-flight dead-letter recovery; after the remote
receipt arrives, acknowledgement succeeds and the source remains tombstoned.
Renewal reconciliation also requires finite timestamps and a strictly later
deadline.

**Next:** Repeat the independent quality review and full verification from the
stable ownership implementation.

### State-machine re-review closure

Repeated adversarial review then exercised every transition around that
ownership protocol. The figure-it-out decision was to represent each
in-progress operation as durable request state, rather than add timing retries:

- a new reservation materializes the exact request bytes in a claimable
  `*.materializing.json` record, so concurrent first persistence and crashes
  converge on one identity;
- live renewal bytes may be observed but do not advance the source reservation
  until the renewed dead letter is durably restored;
- discard owns primary/dead-letter state before scanning reservations, treats
  reappearing canonical state as a conflict, and never deletes an acknowledged
  tombstone;
- discard first writes a non-expiring `*.discarding.<token>.json` intent that blocks
  new materialization, direct persistence, and claims across the final
  ownership check; every discard owns an exact token filename, cancellation
  removes only that token, and terminal commit hard-links it to the tombstone,
  so concurrent recovery has no shared canonical alias or ABA window;
- acknowledgement writes a separate indefinite source-identity tombstone, so
  a stale discard snapshot cannot erase a receipt that commits after takeover;
- acknowledgement recovery recognizes primary, materializing, delivery claim,
  recovery claim, and dead-letter filenames, with the ack journal winning after
  a cleanup crash;
- operator listing restores expired recovery claims before presenting the
  dead-letter backlog.

**Premortem:** a new filename state is added but omitted from acknowledgement
or discard. Keep the filename parsers centralized and require a crash/race test
for both ack-wins and discard-fails-closed behavior before adding a state.

**Evidence:** real-filesystem tests pause persistence, delivery, discard,
renewal, and recovery at the reported interleavings. They assert one request
identity, no surviving deliverable after acknowledgement, retained tombstones,
and visible expired recovery work.
