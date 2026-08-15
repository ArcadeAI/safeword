# Test Definitions: Durable independent review

Feature source: `packages/cli/features/durable-independent-review.feature`

## Post-delivery scenario repair

An independent review after delivery found that the original five scenarios did
not make terminal failure, cancellation finality, positive source binding, or
record integrity observable. The scenarios below were added against existing
durable-job behavior; focused Vitest evidence is recorded with the repair.

## Process deviation

The initial implementation and its five scenario proofs landed together in `77abbe01d`, so no auditable failing-test commits exist. The RED entries below are intentionally left incomplete: they document missing historical evidence, not a valid TDD exception. Subsequent review fixes used failing regression tests before GREEN.

## Rule: finish-deep-reviews-in-background.TBU1.R1 — A healthy review outlives its foreground courtesy wait

### Scenario: A quick review returns its verdict inline

- [x] RED skip: process deviation documented above; no auditable failing-test commit exists
- [x] GREEN 77abbe01d
- [x] REFACTOR skip: no scenario-local structural cleanup emerged after GREEN

### Scenario: A slow healthy review continues as a durable job

- [x] RED skip: process deviation documented above; no auditable failing-test commit exists
- [x] GREEN 77abbe01d
- [x] REFACTOR skip: no scenario-local structural cleanup emerged after GREEN

### Scenario: A detached review can be collected after its caller exits

- [x] RED skip: process deviation documented above; no auditable failing-test commit exists
- [x] GREEN 77abbe01d
- [x] REFACTOR skip: no scenario-local structural cleanup emerged after GREEN

## Rule: finish-deep-reviews-in-background.TBU1.R2 — A collected result is bound to the source it reviewed

### Scenario: An unchanged reviewed source keeps its completed result

- [x] GREEN 586dab3e2

### Scenario: An unrelated source change does not stale a completed review

- [x] GREEN 586dab3e2

### Scenario: Restoring a reviewed source's identical content keeps its completed result

- [x] GREEN abba47cd6

### Scenario: Source changes make a completed review stale

- [x] GREEN 77abbe01d

### Scenario: A tampered completed review result is not accepted

- [x] GREEN 586dab3e2

### Scenario: A tampered completed review binding is not accepted

- [x] GREEN 586dab3e2

### Scenario: A changed bound context makes a completed review stale

- [x] GREEN 586dab3e2

### Scenario: Deleting a reviewed source makes a completed review stale

- [x] GREEN abba47cd6

### Scenario: Collecting a malformed or unknown review is rejected

- [x] GREEN 726c69173

### Scenario: Status does not resolve a traversal-shaped identifier outside the review store

- [x] GREEN 726c69173

### Scenario: A completed record missing its integrity seal is not accepted

- [x] GREEN 726c69173

## Rule: finish-deep-reviews-in-background.TBU1.R3 — A builder can stop a review that is no longer useful

### Scenario: A running review is canceled explicitly

- [x] RED skip: process deviation documented above; no auditable failing-test commit exists
- [x] GREEN 77abbe01d
- [x] REFACTOR skip: no scenario-local structural cleanup emerged after GREEN

### Scenario: Canceling a running review terminates its reviewer

- [x] GREEN 586dab3e2

### Scenario: A late reviewer result cannot replace a canceled result

- [x] GREEN 586dab3e2

### Scenario: Canceling a completed review preserves its completed result

- [x] GREEN 586dab3e2

### Scenario: Canceling an unknown review is rejected

- [x] GREEN 586dab3e2

## Rule: finish-deep-reviews-in-background.TBU1.R4 — A background review reaches a terminal result when it cannot complete

### Scenario: A detached reviewer that exits without a result fails terminally

- [x] GREEN 586dab3e2

### Scenario: A wedged reviewer that never records an outcome fails terminally at its controlled absolute deadline

- [x] GREEN 726c69173

### Scenario: A reviewer that exits with malformed output fails terminally

- [x] GREEN 726c69173

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: audit found correctness and contract fixes, but no shared structural duplication
