# Test Definitions: Operate the retry-safe retro relay

Feature source: `features/operate-retry-safe-retro-relay.feature`

## Rule: One immutable persisted request crosses every harness without acquiring a new identity

### Scenario: Each harness submits the exact request persisted by another harness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A retry cannot replace the persisted payload or request identity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: An unreachable relay returns control within one second and leaves a visible retryable draft

### Scenario: Relay unavailability preserves the draft without delaying the session

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An active spool claim excludes another session

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An expired spool claim is rearmed without changing the request

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Persisting a new request while another request drains cannot lose either draft

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A local draft is acknowledged only after the relay durably accepts that exact request

### Scenario: Durable acceptance drains the local draft

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Losing the durable receipt response leaves the same draft retryable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Relay routing is fail-closed until the canonical readiness prerequisites are proven

### Scenario: Incomplete readiness proof preserves the existing filing path

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Complete fresh readiness proof selects the relay path

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Stale or malformed readiness proof fails closed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Closed but unlanded or wrong-repository evidence fails closed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Readiness for another build fails closed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Headless extraction receives no filing credential

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Authentication and repository authorization vary by principal while request identity does not

### Scenario: Production startup authenticates separate harness and operator principals

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Rotating one harness credential leaves the other principals active

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A principal cannot cross its repository boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A harness principal cannot read operator operations

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each principal is denied every excluded role

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Spike mode exposes health only

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: GitHub installation tokens remain opaque inside the relay

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Production filing requests are resource bounded

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Retry grace dead-letter compaction and tombstone deadlines are durable and alertable

### Scenario: Maintenance enforces each lifecycle boundary exactly once

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Durable retry scheduling survives restart

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No new dispatch starts at the retry deadline

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A late dispatch resolves or becomes ambiguous by one CAS winner

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Interrupted schema migration rolls back atomically

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unsupported schema metadata is rejected before listen

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Terminal identity cannot be deleted or silently reidentified

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A compacted request immediately replays its original filed result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Operational state is readable without exposing approved payloads or credentials

### Scenario: The operator sees lifecycle counts through the real HTTP route without secret content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Maintenance emits a deduplicable structured alert for each newly terminal request

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Immediate ambiguous outcomes are durably alertable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
