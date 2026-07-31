# Test Definitions: Operate the retry-safe retro relay

Feature source: `features/operate-retry-safe-retro-relay.feature`

## Rule: One immutable persisted request crosses every harness without acquiring a new identity

### Scenario: Each harness submits the exact request persisted by another harness

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: A retry cannot replace the persisted payload or request identity

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

## Rule: An unreachable relay returns control within one second and leaves a visible retryable draft

### Scenario: Relay unavailability preserves the draft without delaying the session

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: A multi-draft drain shares one aggregate latency budget

- [x] RED skip: live review supplied the failing aggregate-budget evidence
- [x] GREEN 88e0b2de0
- [x] REFACTOR skip: claim extraction landed with the review fix

### Scenario: Historical dead letters do not permanently request agent fallback

- [x] RED skip: live review supplied the failing sticky-backlog evidence
- [x] GREEN 88e0b2de0
- [x] REFACTOR skip: counter separation landed with the review fix

### Scenario: An active spool claim excludes another session

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: An expired spool claim is rearmed without changing the request

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Persisting a new request while another request drains cannot lose either draft

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

## Rule: A local draft is acknowledged only after the relay durably accepts that exact request

### Scenario: Durable acceptance drains the local draft

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Losing the durable receipt response leaves the same draft retryable

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

## Rule: Relay routing is fail-closed until the canonical readiness prerequisites are proven

### Scenario: Incomplete readiness proof preserves the existing filing path

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Complete fresh readiness proof selects the relay path

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Stale or malformed readiness proof fails closed

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Closed but unlanded or wrong-repository evidence fails closed

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Readiness for another build fails closed

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Headless extraction receives no filing credential

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

## Rule: Authentication and repository authorization vary by principal while request identity does not

### Scenario: Production startup authenticates separate harness and operator principals

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Rotating one harness credential leaves the other principals active

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: A principal cannot cross its repository boundary

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: A harness principal cannot read operator operations

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Each principal is denied every excluded role

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Spike mode exposes health only

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: GitHub installation tokens remain opaque inside the relay

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Production filing requests are resource bounded

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

## Rule: Retry grace dead-letter compaction and tombstone deadlines are durable and alertable

### Scenario: Maintenance enforces each lifecycle boundary exactly once

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Durable retry scheduling survives restart

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: No new dispatch starts at the retry deadline

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: A late dispatch resolves or becomes ambiguous by one CAS winner

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Interrupted schema migration rolls back atomically

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Unsupported schema metadata is rejected before listen

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Terminal identity cannot be deleted or silently reidentified

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: A compacted request immediately replays its original filed result

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

## Rule: Operational state is readable without exposing approved payloads or credentials

### Scenario: The operator sees lifecycle counts through the real HTTP route without secret content

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Maintenance emits a deduplicable structured alert for each newly terminal request

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

### Scenario: Immediate ambiguous outcomes are durably alertable

- [x] RED baf8b6ad9
- [x] GREEN a1f69bd9a
- [x] REFACTOR 2cde456ca

---

## Feature-level cross-scenario refactor

- [x] cross-scenario 2cde456ca

## 2026-07-28 fourth-round PR review regressions

### Scenario: Renewed dead-letter bytes remain coherent after operator rearm

- [x] RED skip: demonstrated locally before implementation; no separate commit
- [x] GREEN 75204fad9
- [x] REFACTOR skip: completed before the GREEN commit; no distinct commit

### Scenario: Acknowledgement retains one immutable source tombstone

- [x] RED skip: demonstrated locally before implementation; no separate commit
- [x] GREEN 75204fad9
- [x] REFACTOR skip: completed before the GREEN commit; no distinct commit

### Scenario: Operator listing discovers every discardable request identity

- [x] RED skip: demonstrated locally before implementation; no separate commit
- [x] GREEN 75204fad9
- [x] REFACTOR skip: completed before the GREEN commit; no distinct commit

### Scenario: Concurrent expired-claim cleanup is benign

- [x] RED skip: demonstrated locally before implementation; no separate commit
- [x] GREEN 75204fad9
- [x] REFACTOR skip: completed before the GREEN commit; no distinct commit

### Scenario: Live discard intent cannot be recovered as a crash

- [x] RED skip: demonstrated locally before implementation; no separate commit
- [x] GREEN 75204fad9
- [x] REFACTOR skip: completed before the GREEN commit; no distinct commit

### Scenario: Explicit discard cannot mint a replacement source identity

- [x] RED skip: demonstrated locally before implementation; no separate commit
- [x] GREEN 75204fad9
- [x] REFACTOR skip: completed before the GREEN commit; no distinct commit

## 2026-07-29 independent quality-review regressions

### Scenario: Empty or semantically irrelevant readiness evidence fails closed

- [x] RED skip: reproduced locally before implementation; no separate commit
- [x] GREEN 10f07c448
- [x] REFACTOR e7a115b91

### Scenario: One external durable outbox survives disposable harness workspaces

- [x] RED skip: reproduced locally before implementation; no separate commit
- [x] GREEN 10f07c448
- [x] REFACTOR e7a115b91

### Scenario: Persistence success is not reported before file and directory sync

- [x] RED skip: reproduced locally before implementation; no separate commit
- [x] GREEN 10f07c448
- [x] REFACTOR e7a115b91

### Scenario: GitHub create classification ignores undocumented response prose

- [x] RED skip: reproduced locally before implementation; no separate commit
- [x] GREEN 10f07c448
- [x] REFACTOR e7a115b91

### Scenario: The built production process files through every real collaborator

- [x] RED skip: reproduced locally before implementation; no separate commit
- [x] GREEN 10f07c448
- [x] REFACTOR e7a115b91

## 2026-07-29 final independent re-review regressions

### Scenario: A multi-draft blackhole cannot exceed the session latency budget

- [x] RED skip: reproduced a 1.55-second drain locally before implementation
- [x] GREEN ec32ac2fc
- [x] REFACTOR skip: the shared 250-millisecond headroom policy is already centralized

### Scenario: GitHub 422 preserves the draft without response-prose inference

- [x] RED skip: reproduced terminal acknowledgement for both documented 422 meanings
- [x] GREEN ec32ac2fc
- [x] REFACTOR skip: the status-only classification table is already minimal

## 2026-07-29 fifth-round PR review regressions

### Scenario: A production-sized persistence batch does not rescan the full backlog per finding

- [x] RED 1c2449cbb
- [x] GREEN 4428378aa
- [x] REFACTOR 42240b3e6

### Scenario: Configured but invalid relay state fails visibly instead of selecting native filing

- [x] RED 1c2449cbb
- [x] GREEN 4428378aa
- [x] REFACTOR b35b0a9ce

### Scenario: Recovery removes only stale atomic-write temporaries

- [x] RED 1c2449cbb
- [x] GREEN 4428378aa
- [x] REFACTOR skip: the age-aware cleanup helper is already minimal

### Scenario: Cross-directory durable rename synchronizes both directory entries

- [x] RED 1c2449cbb
- [x] GREEN 4428378aa
- [x] REFACTOR skip: the two-parent synchronization branch is already minimal

### Scenario: Filesystem root cannot become the client outbox

- [x] RED 1c2449cbb
- [x] GREEN 4428378aa
- [x] REFACTOR skip: root rejection is one guard in the shared path validator

### Scenario: A failed dead-letter rearm tells the operator how to recover

- [x] RED 1c2449cbb
- [x] GREEN 4428378aa
- [x] REFACTOR skip: the ownership-loss diagnostic is already one explicit branch

## 2026-07-29 fifth-round independent re-review regressions

### Scenario: A production batch takes one coordinated post-reservation state snapshot

- [x] RED ec5b198c4
- [x] GREEN 53e720741
- [x] REFACTOR 188e17c96

### Scenario: Invalid enabled relay configuration stops the real command before collaborators run

- [x] RED ec5b198c4
- [x] GREEN 53e720741
- [x] REFACTOR skip: command wiring is one explicit fail-closed branch

### Scenario: A real filesystem ownership race emits failed-rearm recovery guidance

- [x] RED ec5b198c4
- [x] GREEN 53e720741
- [x] REFACTOR skip: the fault seam and ownership-loss branch are already minimal

## 2026-07-29 coordinated-snapshot correctness regressions

### Scenario: A canceled snapshotted discard intent does not suppress materialization

- [x] RED 865485c2c
- [x] GREEN d107d85f0
- [x] REFACTOR cca343524

### Scenario: A coordinated snapshot failure settles every batch outcome

- [x] RED 865485c2c
- [x] GREEN d107d85f0
- [x] REFACTOR 1563ecf72

### Scenario: Best-effort temporary cleanup cannot overturn a durable write

- [x] RED 865485c2c
- [x] GREEN d107d85f0
- [x] REFACTOR skip: cleanup is one best-effort helper with recovery ownership

### Scenario: An injected rearm fault is not reported as an invalid request identity

- [x] RED 865485c2c
- [x] GREEN d107d85f0
- [x] REFACTOR skip: the injected seam now sits directly outside UUID validation

### Scenario: A concurrent loser durably observes the winning hard link

- [x] RED 752c51a76
- [x] GREEN 31f4ad0d8
- [x] REFACTOR skip: `linkDurable` needs one EEXIST synchronization branch

## 2026-07-29 sixth-round quality-review regressions

### Scenario: Invalid configured outboxes never redirect recovery commands into the project

- [x] RED 9741606db
- [x] GREEN 1b660c278
- [x] REFACTOR 993b4917f

### Scenario: Successful relay receipts acknowledge only known non-ambiguous durable states

- [x] RED 940fae6ab
- [x] GREEN a83f52882
- [x] REFACTOR skip: receipt validation and server-dead-letter reporting are already separated helpers

### Scenario: Equivalent absolute outbox spellings resolve to one physical directory

- [x] RED 6f92318ef
- [x] GREEN e8a348623
- [x] REFACTOR skip: normalization now precedes the existing physical-containment check

### Scenario: An unreserved corrupt identity fails the persistence batch closed

- [x] RED b0c60867e
- [x] CHARACTERIZATION skip: recorded as the scenario's evidence commit above
- [x] GREEN skip: the characterization confirms the existing intended fail-closed boundary
- [x] REFACTOR skip: the coordinated snapshot already owns the batch-wide fail-closed boundary

### Scenario: Relay readiness requires measured bounded drain throughput

- [x] RED 24dc50714
- [x] GREEN c32143ff6
- [x] REFACTOR 617eced4d

## 2026-07-30 seventh-round quality-review regressions

### Scenario: Terminal relay ownership remains visible and operator-addressable

- [x] RED 6f980a323
- [x] GREEN 79a5906bd
- [x] REFACTOR a80b86a31

### Scenario: The bounded drain attempts the earliest retry deadline first

- [x] RED 6f980a323
- [x] GREEN 79a5906bd
- [x] REFACTOR a80b86a31

### Scenario: Partial scalar configuration reports scalar failure before outbox failure

- [x] RED 6f980a323
- [x] GREEN 79a5906bd
- [x] REFACTOR a80b86a31

### Scenario: Corrupt identity failure names the request and destructive recovery command

- [x] RED 6f980a323
- [x] GREEN 79a5906bd
- [x] REFACTOR a80b86a31

### Scenario: A real durable-spool command produces drain-throughput evidence

- [x] RED 6f980a323
- [x] GREEN 79a5906bd
- [x] REFACTOR a80b86a31

### Scenario: Relay API v1 freezes receipt ownership states for old clients

- [x] RED 6f980a323
- [x] GREEN 79a5906bd
- [x] REFACTOR a80b86a31

### Scenario: Renewal rollback requires a typed payload rejection

- [x] RED 6f980a323
- [x] GREEN 79a5906bd
- [x] REFACTOR a80b86a31

### Scenario: Syntactically valid corrupt relay JSON is visibly isolated

- [x] RED 5ed5e5fb8
- [x] GREEN 73351a6ca
- [x] REFACTOR a80b86a31

## 2026-07-30 eighth-round quality-review regressions

### Scenario: A corrupt durable request cannot block unrelated new persistence

- [x] RED current working tree
- [x] GREEN current working tree
- [x] REFACTOR current working tree: explicit active/dead-letter parsing and focused regression suite

### Scenario: A timed-out earliest request leaves bounded time for a healthy request

- [x] RED current working tree
- [x] GREEN current working tree
- [x] REFACTOR current working tree: remaining-budget deadline cap preserves aggregate bound

### Scenario: Unresolved server-owned terminal receipts fail visibly without native filing

- [x] RED current working tree
- [x] GREEN current working tree
- [x] REFACTOR current working tree: terminal ownership is reported without creating a second filer

### Scenario: Drain throughput evidence attests production timing configuration

- [x] RED current working tree
- [x] GREEN current working tree
- [x] REFACTOR current working tree: v2 evidence schema records the actual production timing

### Scenario: Relay protocol mismatch and malformed receipt retain local ownership

- [x] RED current working tree
- [x] GREEN current working tree
- [x] REFACTOR current working tree: malformed server responses retain recoverable local state
