# Test Definitions: Closeout preview and apply convergence

Feature source: `features/closeout-preview-apply-convergence.feature`

test-definitions.md is the R/G/R ledger.

## Rule: closeout-preview-apply-convergence.NTB1.R1 — Preview and apply converge on one bounded retrospective result

### Scenario: An unsealed finding remains observable to retrospective extraction

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Distinct findings survive signature deduplication

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Preview reporting advances only a bounded retrospective delta

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A finding appended during extraction is evaluated in the same invocation

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Continuously expanding extraction input fails closed after bounded windows

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A partially written transcript record is not sealed or lost

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A previously partial record is evaluated after completion

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A successful retro with no pending filing is reusable

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A post-preview finding converges after filing

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A new post-preview finding blocks cleanup before filing

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Malformed sealed retrospective receipts are ignored and replaced

- [x] RED
- [x] GREEN
- [x] REFACTOR

The outline is complete only when all four invalid-evidence rows pass.

## Rule: closeout-preview-apply-convergence.NTB1.R2 — Bootstrap and linked-worktree tasks receive an exact supported identity path

### Scenario: A fresh hook binding is consumed after sealing its exact transcript

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A fresh hook binding cannot cross the authenticated ownership boundary

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: OpenAI Codex Desktop binds the current task across linked worktrees

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Apply recovers when preview's consumed hook binding is presented again

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A consumed binding cannot override an authenticated current task

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A consumed hook binding cannot authenticate a task by itself

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A bootstrap task can use the guard installed during the task

- [x] RED
- [x] GREEN
- [x] REFACTOR

The outline is complete only when both install and upgrade rows pass.

### Scenario: A bootstrap identity cannot cross its project ownership boundary

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: closeout-preview-apply-convergence.TBU1.R1 — Authenticated filing evidence converges across worktree and session boundaries

### Scenario: Draining removes only acknowledged drafts

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Authenticated fallback drains the named spool from another worktree and session

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A noncanonical fallback spool is refused

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Repeated apply preserves one unacknowledged draft

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A fallback spool with a modified sealed body is refused

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Unavailable filing preserves authenticated drafts for retry

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: closeout-preview-apply-convergence.TBU1.R2 — Repository or cleanup-target drift still prevents mutation

### Scenario: Retrospective progress alone preserves cleanup authorization

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Cleanup-target drift remains blocking when retro progress also advances

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Feature-level cross-scenario refactor

- [x] cross-scenario
