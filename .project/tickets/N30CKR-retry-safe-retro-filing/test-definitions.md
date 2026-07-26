# Test Definitions: Retry-safe retro relay foundation

Feature source: `features/retry-safe-retro-filing.feature`

## Rule: Request identity is stable across harness adapters and payload changes are rejected

### Scenario: Every named harness adapter retries through the real relay route

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Changing an approved payload field is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: First attempts and retries create at most one GitHub issue per request

### Scenario: Concurrent first attempts return one durable receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Losing the relay response after filing is safe to retry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Uncertain delivery remains visible and recoverable without automatic recreation

### Scenario: A crash after GitHub create becomes ambiguous without acknowledgement or recreation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The admin route adopts exactly one raw request-marker match

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Authorization is repository-scoped and independent of dedupe identity

### Scenario: Repository authorization determines whether filing proceeds

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid authentication is rejected before GitHub

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Authorized filing credentials never enter durable state or observability

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: GitHub creation uses a repository-scoped relay credential

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Only complete raw REST issue bodies are marker authority

### Scenario: Only the raw REST body can authorize semantic marker adoption

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Incomplete or non-unique raw enumeration never authorizes creation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
