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

- [x] RED — `01bb33bbf` (public two-command reproduction failed on strict primary comparison)
- [x] GREEN — `01bb33bbf` (compatible renewal reconciliation covers every durable client state)
- [x] REFACTOR — `01bb33bbf` (one strict compatibility predicate remains authoritative)

### Scenario: Acknowledgement retains one immutable source tombstone

- [x] RED — `01bb33bbf` (structural footprint test observed two permanent source files)
- [x] GREEN — `01bb33bbf` (durable acknowledgement removes the redundant active filename)
- [x] REFACTOR — `01bb33bbf` (exact active-reservation filenames exclude acknowledgement files)

### Scenario: Operator listing discovers every discardable request identity

- [x] RED — `01bb33bbf` (built CLI listed only dead letters without state)
- [x] GREEN — `01bb33bbf` (payload-free state-aware listing covers active and dead-letter state)
- [x] REFACTOR — `01bb33bbf` (one recovered directory snapshot supplies the
  listing and explicit ownership precedence labels transient siblings truthfully)

### Scenario: Concurrent expired-claim cleanup is benign

- [x] RED — `01bb33bbf` (review supplied the check/read/unlink race;
  real-filesystem concurrency coverage exercises both claim kinds)
- [x] GREEN — `01bb33bbf` (disappeared claim or sibling reads are treated as a won recovery race)
- [x] REFACTOR — `01bb33bbf` (one guarded pair-read helper owns ENOENT handling)

### Scenario: Live discard intent cannot be recovered as a crash

- [x] RED — `01bb33bbf` (paused live owner was immediately converted to a discarded tombstone)
- [x] GREEN — `01bb33bbf` (intent lease delays recovery and exact terminal validation converges
  after expiry)
- [x] REFACTOR — `01bb33bbf` (foreign-claim cancellation remains immediate and token-specific)

### Scenario: Explicit discard cannot mint a replacement source identity

- [x] RED — `01bb33bbf` (persisting the same draft after discard acquired a fresh request ID)
- [x] GREEN — `01bb33bbf` (discard compacts the active reservation into a durable
  source tombstone and later persistence returns no request)
- [x] REFACTOR — `01bb33bbf` (source acknowledgement and discard use parallel
  terminal records, with acknowledgement taking precedence and removing a
  concurrent redundant discard tombstone)
