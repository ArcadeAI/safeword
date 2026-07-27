# Test Definitions: Retry-safe retro relay foundation

Feature source: `features/retry-safe-retro-filing.feature`

## Rule: Request identity is stable across harness adapters and payload changes are rejected

### Scenario: Every named harness adapter retries through the real relay route

- [x] RED c9df9183e
- [x] GREEN 8b333017e
- [x] REFACTOR 6eea11b96

### Scenario: Changing an approved payload field is rejected

- [x] RED c9df9183e
- [x] GREEN 8b333017e
- [x] REFACTOR 8b333017e

## Rule: First attempts and retries create at most one GitHub issue per request

### Scenario: Concurrent first attempts return one durable receipt

- [x] RED c9df9183e
- [x] GREEN 8b333017e
- [x] REFACTOR 8b333017e

### Scenario: Losing the relay response after filing is safe to retry

- [x] RED c9df9183e
- [x] GREEN 8b333017e
- [x] REFACTOR 8b333017e

## Rule: Uncertain delivery remains visible and recoverable without automatic recreation

### Scenario: A crash after GitHub create becomes ambiguous without acknowledgement or recreation

- [x] RED c9df9183e
- [x] GREEN 8b333017e
- [x] REFACTOR 8b333017e

### Scenario: The admin route adopts exactly one raw request-marker match

- [x] RED c9df9183e
- [x] GREEN 8b333017e
- [x] REFACTOR 8b333017e

## Rule: Authorization is repository-scoped and independent of dedupe identity

### Scenario: Repository authorization determines whether filing proceeds

- [x] RED c9df9183e
- [x] GREEN 8b333017e
- [x] REFACTOR 8b333017e

### Scenario: Invalid authentication is rejected before GitHub

- [x] RED c9df9183e
- [x] GREEN 8b333017e
- [x] REFACTOR 8b333017e

### Scenario: Authorized filing credentials never enter durable state or observability

- [x] RED c9df9183e
- [x] GREEN 8b333017e
- [x] REFACTOR 8b333017e

### Scenario: GitHub creation uses a repository-scoped relay credential

- [x] RED c9df9183e
- [x] GREEN 8b333017e
- [x] REFACTOR 8b333017e

## Rule: Only complete raw REST issue bodies are marker authority

### Scenario: Only the raw REST body can authorize semantic marker adoption

- [x] RED c9df9183e
- [x] GREEN 8b333017e
- [x] REFACTOR 8b333017e

### Scenario: Incomplete or non-unique raw enumeration never authorizes creation

- [x] RED c9df9183e
- [x] GREEN 8b333017e
- [x] REFACTOR 8b333017e

---

## Feature-level cross-scenario refactor

- [x] cross-scenario 6eea11b96
