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

### Scenario: A detached reviewer that exits without a result fails terminally

- [x] GREEN `packages/cli/tests/review/job.test.ts` — worker-exit regression

### Scenario: A reviewer that exceeds its absolute deadline fails terminally

- [x] GREEN `packages/cli/tests/review/runtime.test.ts` and `packages/cli/tests/cli-protocol/review-wiring.test.ts` — bounded timeout and typed terminal-result regressions

## Rule: finish-deep-reviews-in-background.TBU1.R2 — A collected result is bound to the source it reviewed

### Scenario: An unchanged reviewed source keeps its completed result

- [x] GREEN `packages/cli/tests/review/job.test.ts` — collect completed result regression

### Scenario: An unrelated source change does not stale a completed review

- [x] GREEN `packages/cli/tests/review/job.test.ts` — unrelated-source regression

### Scenario: Source changes make a completed review stale

- [x] GREEN 77abbe01d

### Scenario: A tampered completed review result is not accepted

- [x] GREEN `packages/cli/tests/review/job.test.ts` — verdict-forgery regression

### Scenario: A tampered completed review binding is not accepted

- [x] GREEN `packages/cli/tests/review/job.test.ts` — source-binding-forgery regression

### Scenario: A changed bound context makes a completed review stale

- [x] GREEN `packages/cli/tests/review/job.test.ts` — context-only staleness regression

## Rule: finish-deep-reviews-in-background.TBU1.R3 — A builder can stop a review that is no longer useful

### Scenario: A running review is canceled explicitly

- [x] RED skip: process deviation documented above; no auditable failing-test commit exists
- [x] GREEN 77abbe01d
- [x] REFACTOR skip: no scenario-local structural cleanup emerged after GREEN

### Scenario: A late reviewer result cannot replace a canceled result

- [x] GREEN `packages/cli/tests/review/job.test.ts` — terminal-cancellation regression

### Scenario: Canceling a completed review preserves its completed result

- [x] GREEN `packages/cli/tests/review/job.test.ts` — completed-cancel regression (focused CI verification queued)

### Scenario: Canceling an unknown review is rejected

- [x] GREEN `packages/cli/tests/review/job.test.ts` — unknown-ID regression

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: audit found correctness and contract fixes, but no shared structural duplication
