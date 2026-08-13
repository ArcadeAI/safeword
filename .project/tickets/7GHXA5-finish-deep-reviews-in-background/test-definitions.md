# Test Definitions: Durable independent review

Feature source: `packages/cli/features/durable-independent-review.feature`

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

### Scenario: Source changes make a completed review stale

- [x] RED skip: process deviation documented above; no auditable failing-test commit exists
- [x] GREEN 77abbe01d
- [x] REFACTOR skip: no scenario-local structural cleanup emerged after GREEN

## Rule: finish-deep-reviews-in-background.TBU1.R3 — A builder can stop a review that is no longer useful

### Scenario: A running review is canceled explicitly

- [x] RED skip: process deviation documented above; no auditable failing-test commit exists
- [x] GREEN 77abbe01d
- [x] REFACTOR skip: no scenario-local structural cleanup emerged after GREEN

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: audit found correctness and contract fixes, but no shared structural duplication
