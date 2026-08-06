# Test Definitions: Retry-safe retro relay foundation

Feature source: `features/retry-safe-retro-filing.feature`

## Rule: Request identity is stable across harness adapters and payload changes are rejected

### Scenario: Every named harness adapter retries through the real relay route

- [x] RED c9df9183e
- [x] GREEN 247600f5b
- [x] REFACTOR 6eea11b96

### Scenario: Changing an approved payload field is rejected

- [x] RED c9df9183e
- [x] GREEN 247600f5b
- [x] REFACTOR 6eea11b96

## Rule: First attempts and retries create at most one GitHub issue per request

### Scenario: Concurrent first attempts return one durable receipt

- [x] RED c9df9183e
- [x] GREEN 247600f5b
- [x] REFACTOR 6eea11b96

### Scenario: Losing the relay response after filing is safe to retry

- [x] RED c9df9183e
- [x] GREEN 247600f5b
- [x] REFACTOR 6eea11b96

## Rule: Uncertain delivery remains visible and recoverable without automatic recreation

### Scenario: A crash after GitHub create becomes ambiguous without acknowledgement or recreation

- [x] RED c9df9183e
- [x] GREEN 247600f5b
- [x] REFACTOR 6eea11b96

### Scenario: The admin route adopts exactly one raw request-marker match

- [x] RED c9df9183e
- [x] GREEN 247600f5b
- [x] REFACTOR 6eea11b96

### Scenario: An operator manually recovers a complete zero-match with the original marker

- [x] RED skip: live review supplied the failing missing-recovery evidence
- [x] GREEN 39c5aeaa6
- [x] REFACTOR skip: state-machine integration landed with the review fix

### Scenario: A queued encrypted request survives payload-key rotation

- [x] RED skip: live review supplied the failing key-rotation evidence
- [x] GREEN 39c5aeaa6
- [x] REFACTOR skip: keyring extraction landed with the review fix

## Rule: Authorization is repository-scoped and independent of dedupe identity

### Scenario: Repository authorization determines whether filing proceeds

- [x] RED c9df9183e
- [x] GREEN 247600f5b
- [x] REFACTOR 6eea11b96

### Scenario: Invalid authentication is rejected before GitHub

- [x] RED c9df9183e
- [x] GREEN 247600f5b
- [x] REFACTOR 6eea11b96

### Scenario: Authorized filing credentials never enter durable state or observability

- [x] RED c9df9183e
- [x] GREEN 247600f5b
- [x] REFACTOR 6eea11b96

### Scenario: GitHub creation uses a repository-scoped relay credential

- [x] RED c9df9183e
- [x] GREEN 247600f5b
- [x] REFACTOR 6eea11b96

## Rule: Only complete raw REST issue bodies are request-marker authority

### Scenario: Sanitized MCP bodies never decide ambiguous-create recovery

- [x] RED c9df9183e
- [x] GREEN 247600f5b
- [x] REFACTOR 6eea11b96

### Scenario: Incomplete raw enumeration never resolves an ambiguous create

- [x] RED c9df9183e
- [x] GREEN 247600f5b
- [x] REFACTOR 6eea11b96

---

## Feature-level cross-scenario refactor

- [x] cross-scenario 6eea11b96
