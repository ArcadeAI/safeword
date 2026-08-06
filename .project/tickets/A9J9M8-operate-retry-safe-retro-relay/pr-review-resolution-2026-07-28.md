# PR #1522 review resolution — 2026-07-28

This note applies the `quality-review` and `figure-it-out` workflows to
[#1522's latest review](https://github.com/ArcadeAI/safeword/pull/1522#issuecomment-5105516755).
The live [#1479 body](https://github.com/ArcadeAI/safeword/issues/1479) remains
the canonical contract.

## Review plan

- **Contract and supersession:** distinguish request idempotency from semantic
  dedupe, preserve the explicit retention rules, and check #834/#1495 gates.
- **Failure safety:** inspect corrupt local state, credential rotation, budget
  exhaustion, expired manual replay, database repair, shutdown, and token
  invalidation.
- **Operations and scale:** inspect spool growth, reconciliation bounds,
  Railway volume ownership, image reproducibility, and rollback behavior.
- **Wiring:** require real filesystem, HTTP, SQLite, process, and container
  collaborators at their respective boundaries.
- **Primary sources:** GitHub REST/App authentication, HTTP 401 semantics,
  Docker `USER`/entrypoint behavior, Debian package versions, Railway volume
  ownership, and SQLite transaction behavior.

## Figure-it-out investigation

### Phase 1 — decisions

For each R1–R14 item, decide whether the smallest correct response is a code
fix, an explicit operational contract, or rejection because it conflicts with
the canonical scope.

### Phase 2 — options

Each item is evaluated against the same three concrete options:

1. **Implement now:** add the smallest behavior and regression proof.
2. **Constrain/document:** retain the behavior but make its boundary and
   recovery path explicit.
3. **Reject/defer:** record why the suggestion conflicts with #1479 or expands
   beyond the measured problem.

### Phase 3a — research domains

- request-idempotency and semantic-dedupe boundaries;
- durable filesystem identity, corruption isolation, and bounded cleanup;
- HTTP authentication recovery and GitHub App token expiry/revocation;
- deadline state machines and operator-authorized manual replay;
- SQLite migration repair, transactions, retention, and key retirement;
- raw REST pagination completeness, latency, and configurable limits;
- container privilege dropping, Railway volume ownership, and reproducible
  Debian dependencies;
- provider credential propagation across Bedrock, Vertex, and Windows;
- truthful CLI progress and recovery ergonomics.

### Phase 3b — current evidence

- GitHub App installation tokens expire after one hour and must be regenerated:
  https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation
- Invalid GitHub REST credentials return 401:
  https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api
- RFC 9110 defines 401 as an authentication challenge, so credential refresh or
  rotation can make a later attempt succeed:
  https://www.rfc-editor.org/rfc/rfc9110
- GitHub REST can terminate requests that take more than ten seconds:
  https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api
- Docker applies `USER` to `ENTRYPOINT` and `CMD`, while its documented
  root-entrypoint pattern performs ownership repair then `exec gosu`:
  https://docs.docker.com/reference/dockerfile
- Railway volumes are mounted at runtime as root:
  https://docs.railway.com/volumes
- Debian bookworm publishes `gosu` as `1.14-1+b10`:
  https://packages.debian.org/bookworm/gosu

### Phase 4 — decisions

| Item | Recommendation | Load-bearing reason |
| --- | --- | --- |
| R1 | Implement | Valid per-source reservations let unrelated corrupt request bytes be isolated without authorizing reuse of the corrupt identity. |
| R2 | Implement | A 401 can be repaired by credential rotation; terminalizing durable work is incorrect. |
| R3 | Implement | The reported retry count must equal the durable active backlog, and the overall budget must never be below one request budget. |
| R4 | Reject for this slice | #1479 guarantees one issue per persisted `requestId`, explicitly excludes semantic drift, and the completed remeasurement found no post-fix same-signature collisions. |
| R5 | Implement | The existing allowlist claims Bedrock/Vertex/Windows support but omits required provider inputs. |
| R6 | Implement bounded acknowledgements | Acknowledgement files are crash journals and can be removed after source-reservation compaction; acknowledged source reservations remain indefinite identity tombstones. |
| R7 | Constrain/document | Manual dead-letter recovery replaced the legacy agent spool intentionally; silently restoring two filing owners would weaken the single-boundary design. |
| R8 | Reject | #1479 explicitly requires unresolved ambiguous and dead-letter payloads to remain recoverable and never compacted; deleting their keys would destroy that contract. |
| R9 | Note only | No pre-change relay rows were deployed; changing the format version now adds migration machinery without a live compatibility case. |
| R10 | Implement | A fail-closed scan needs operator-configurable time and page ceilings, and documentation must describe both bounds. |
| R11 | Implement | Repairing NULL `next_attempt_at` on every current-schema open is idempotent and prevents a latent permanent queue wedge. |
| R12 | Pin `gosu`; retain root entrypoint | Railway mounts the volume as root and Docker applies `USER` to the entrypoint, so `USER node` would prevent the required ownership repair. |
| R13 | Implement manual replay | Explicit operator action may renew the retry deadline while preserving `requestId`; automatic retries still stop at 24 hours. |
| R14 | Implement | Closing the lock connection releases its transaction, recovery errors must report durable state, and scan 401s must evict the one-hour token cache. |

Recommend **the targeted fixes above** because they close demonstrated
durability and operability gaps without adding cross-request semantic identity
machinery that #1479 deliberately excludes. Implementing R4 was close because
it preserves the old native-path experience, but it loses on the canonical
request-idempotency scope and the zero-collision remeasurement.

**Premortem:** assume this resolution failed in six months; the likeliest cause
is treating a local manual replay as ordinary automatic retry, so the tests
must prove the deadline is renewed only through the explicit retry command and
the original `requestId` is unchanged.

**Next:** add failing boundary tests for the accepted R1–R14 changes, then make
the minimum implementation pass them.

### Final quality-loop resolution

The fresh post-implementation review raised two additional Important findings:

1. A per-finding local persistence failure was visible in counters but still
   allowed the command to report success. The relay path now drains unrelated
   healthy durable work and then returns `ok: false` with a retry instruction,
   so the caller exits nonzero and never prints success.
2. A sole raw request-marker match could be adopted without checking its
   canonical and legacy evidence. Raw REST scans now retain each matched body;
   both operator endpoints decrypt the durable request and require exact
   whole-line agreement for both evidence markers. Conflicts remain ambiguous
   and receive a durable `conflict` reconciliation audit entry.

Both regressions were demonstrated RED before implementation and GREEN
afterward. The fresh independent delta review returned **APPROVE** with no
remaining blocker.
