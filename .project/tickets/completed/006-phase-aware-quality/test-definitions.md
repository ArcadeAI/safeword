# Test Definitions: Phase-Aware Quality Review

**Ticket:** [006-phase-aware-quality](../issues/006-phase-aware-quality.md)

## Scenarios

### Happy Path - Phase Detection

- [x] **Scenario 1:** Shows intake prompts during discovery phase
  - Given a ticket with `phase: intake` and `status: in_progress`
  - When the quality hook runs after an assistant response with changes
  - Then the prompt includes "Discovery Phase" and "edge cases covered"

- [x] **Scenario 2:** Shows scenario prompts during define-behavior phase
  - Given a ticket with `phase: define-behavior` and `status: in_progress`
  - When the quality hook runs
  - Then the prompt includes "Scenario Phase" and "atomic" and "observable"

- [x] **Scenario 3:** Shows implementation prompts during implement phase
  - Given a ticket with `phase: implement` and `status: in_progress`
  - When the quality hook runs
  - Then the prompt includes "Is it correct?" and "latest docs"

- [x] **Scenario 4:** Shows done prompts during cleanup phase
  - Given a ticket with `phase: done` and `status: in_progress`
  - When the quality hook runs
  - Then the prompt includes "Done Phase" and "dead code" and "/verify"

### Edge Cases - Fallbacks

- [x] **Scenario 5:** Falls back to implement when no phase field
  - Given a ticket without a `phase:` field
  - When the quality hook runs
  - Then the prompt shows default implementation review ("Is it correct?")

- [x] **Scenario 6:** Falls back to implement for unknown phase
  - Given a ticket with `phase: invalid-phase`
  - When the quality hook runs
  - Then the prompt shows default implementation review

### Edge Cases - Ticket Filtering

- [x] **Scenario 7:** Ignores backlog tickets (status filtering)
  - Given ticket A with `status: in_progress` and `phase: intake`
  - And ticket B with `status: backlog` and `phase: implement` (newer timestamp)
  - When the quality hook runs
  - Then it uses phase from ticket A (`intake`)

- [x] **Scenario 8:** Ignores epic tickets (type filtering)
  - Given an epic with `type: epic` and `phase: implement` (newest timestamp)
  - And a feature with `type: feature` and `phase: intake`
  - When the quality hook runs
  - Then it uses phase from the feature (`intake`)

- [x] **Scenario 9:** Falls back when no in_progress tickets
  - Given all tickets have `status: done` or `status: backlog`
  - When the quality hook runs
  - Then the prompt shows default implementation review

- [x] **Scenario 10:** Falls back when issues directory empty
  - Given `.safeword-project/issues/` directory is empty
  - When the quality hook runs
  - Then the prompt shows default implementation review
