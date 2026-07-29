# Test Definitions: Operate the retry-safe retro relay

Feature source: `features/operate-retry-safe-retro-relay.feature`

## Rule: One immutable persisted request crosses every harness without acquiring a new identity

### Scenario: Each harness submits the exact request persisted by another harness

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: A retry cannot replace the persisted payload or request identity

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

## Rule: An unreachable relay returns control within one second and leaves a visible retryable draft

### Scenario: Relay unavailability preserves the draft without delaying the session

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: A multi-draft drain shares one aggregate latency budget

- [x] RED skip: live review supplied the failing aggregate-budget evidence
- [x] GREEN 39c5aeaa6
- [x] REFACTOR skip: claim extraction landed with the review fix

### Scenario: Historical dead letters do not permanently request agent fallback

- [x] RED skip: live review supplied the failing sticky-backlog evidence
- [x] GREEN 39c5aeaa6
- [x] REFACTOR skip: counter separation landed with the review fix

### Scenario: An active spool claim excludes another session

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: An expired spool claim is rearmed without changing the request

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Persisting a new request while another request drains cannot lose either draft

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

## Rule: A local draft is acknowledged only after the relay durably accepts that exact request

### Scenario: Durable acceptance drains the local draft

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Losing the durable receipt response leaves the same draft retryable

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

## Rule: Relay routing is fail-closed until the canonical readiness prerequisites are proven

### Scenario: Incomplete readiness proof preserves the existing filing path

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Complete fresh readiness proof selects the relay path

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Stale or malformed readiness proof fails closed

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Closed but unlanded or wrong-repository evidence fails closed

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Readiness for another build fails closed

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Headless extraction receives no filing credential

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

## Rule: Authentication and repository authorization vary by principal while request identity does not

### Scenario: Production startup authenticates separate harness and operator principals

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Rotating one harness credential leaves the other principals active

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: A principal cannot cross its repository boundary

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: A harness principal cannot read operator operations

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Each principal is denied every excluded role

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Spike mode exposes health only

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: GitHub installation tokens remain opaque inside the relay

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Production filing requests are resource bounded

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

## Rule: Retry grace dead-letter compaction and tombstone deadlines are durable and alertable

### Scenario: Maintenance enforces each lifecycle boundary exactly once

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Durable retry scheduling survives restart

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: No new dispatch starts at the retry deadline

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: A late dispatch resolves or becomes ambiguous by one CAS winner

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Interrupted schema migration rolls back atomically

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Unsupported schema metadata is rejected before listen

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Terminal identity cannot be deleted or silently reidentified

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: A compacted request immediately replays its original filed result

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

## Rule: Operational state is readable without exposing approved payloads or credentials

### Scenario: The operator sees lifecycle counts through the real HTTP route without secret content

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Maintenance emits a deduplicable structured alert for each newly terminal request

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

### Scenario: Immediate ambiguous outcomes are durably alertable

- [x] RED 45789f155
- [x] GREEN dbde2bea6
- [x] REFACTOR b1c339bb0

---

## Feature-level cross-scenario refactor

- [x] cross-scenario b1c339bb0

## 2026-07-28 fourth-round PR review regressions

### Scenario: Renewed dead-letter bytes remain coherent after operator rearm

- [x] RED skip: demonstrated locally before implementation; no separate commit
- [x] GREEN 01bb33bbf
- [x] REFACTOR skip: completed before the GREEN commit; no distinct commit

### Scenario: Acknowledgement retains one immutable source tombstone

- [x] RED skip: demonstrated locally before implementation; no separate commit
- [x] GREEN 01bb33bbf
- [x] REFACTOR skip: completed before the GREEN commit; no distinct commit

### Scenario: Operator listing discovers every discardable request identity

- [x] RED skip: demonstrated locally before implementation; no separate commit
- [x] GREEN 01bb33bbf
- [x] REFACTOR skip: completed before the GREEN commit; no distinct commit

### Scenario: Concurrent expired-claim cleanup is benign

- [x] RED skip: demonstrated locally before implementation; no separate commit
- [x] GREEN 01bb33bbf
- [x] REFACTOR skip: completed before the GREEN commit; no distinct commit

### Scenario: Live discard intent cannot be recovered as a crash

- [x] RED skip: demonstrated locally before implementation; no separate commit
- [x] GREEN 01bb33bbf
- [x] REFACTOR skip: completed before the GREEN commit; no distinct commit

### Scenario: Explicit discard cannot mint a replacement source identity

- [x] RED skip: demonstrated locally before implementation; no separate commit
- [x] GREEN 01bb33bbf
- [x] REFACTOR skip: completed before the GREEN commit; no distinct commit

## 2026-07-29 independent quality-review regressions

### Scenario: Empty or semantically irrelevant readiness evidence fails closed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: One external durable outbox survives disposable harness workspaces

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Persistence success is not reported before file and directory sync

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: GitHub create classification ignores undocumented response prose

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The built production process files through every real collaborator

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
