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
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Configured but invalid relay state fails visibly instead of selecting native filing

- [x] RED 1c2449cbb
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery removes only stale atomic-write temporaries

- [x] RED 1c2449cbb
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cross-directory durable rename synchronizes both directory entries

- [x] RED 1c2449cbb
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Filesystem root cannot become the client outbox

- [x] RED 1c2449cbb
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failed dead-letter rearm tells the operator how to recover

- [x] RED 1c2449cbb
- [ ] GREEN
- [ ] REFACTOR
