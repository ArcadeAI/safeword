# Test Definitions — NMSD94: two-tier review enforcement

**Architecture split:** **[hook]** scenarios are unit-tested — deterministic functions over the review ledger + ticket/coverage state decide deny/allow. **[agent]** scenarios are skill prose (the review actually running inline / in a fresh fork) — verified by live observation like 153's FSX1PP/V6N5PW, and their R/G/R close with `skip: <reason — agent behavior>`.

The per-asset and phase stamps live as lines in the session skill-invocation-log (one store, reused). The PreToolUse gate reads the ledger; the coverage gate reuses `scenario-coverage.ts`.

## Rule: Per-asset stamp gates the next asset **[hook]**

### Scenario: review-gate.DEV1.AC1.unstamped_prior_blocks_next

Given the prior asset has no review stamp in the ledger
When the agent tries to author the next asset
Then the write is denied, naming the unreviewed prior asset

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: review-gate.DEV1.AC1.stamped_prior_allows_next

Given the prior asset carries a review stamp
When the agent authors the next asset
Then the write is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: review-gate.DEV1.AC1.skip_stamp_allows_next

Given the prior asset carries a `skip: <reason>` stamp
When the agent authors the next asset
Then the write is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: review-gate.DEV1.AC1.first_asset_not_gated

Given no prior asset exists for this ticket
When the agent authors the first asset
Then the write is allowed (nothing to gate on)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Per-asset review is inline **[agent]**

### Scenario: review-gate.DEV1.AC2.stamping_spawns_no_subagent

Given the agent reviews a just-authored asset to earn its stamp
When the review runs
Then it is the working agent's own inline pass — no sub-agent is spawned

- [ ] RED skip: agent behavior — live-verified, not unit-tested
- [ ] GREEN skip: agent behavior
- [ ] REFACTOR skip: agent behavior

## Rule: Phase advance needs an independent review stamp **[hook]**

### Scenario: review-gate.DEV2.AC1.no_phase_stamp_blocks_advance

Given no phase-exit review stamp exists for the current phase
When the agent tries to advance the ticket's phase
Then the transition is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: review-gate.DEV2.AC1.phase_stamp_allows_advance

Given a phase-exit review stamp exists for the current phase
When the agent advances the phase
Then the transition is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: review-gate.DEV2.AC1.phase_skip_allows_advance

Given a logged `skip: <reason>` for the phase-exit review
When the agent advances the phase
Then the transition is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Phase review is independent **[agent]**

### Scenario: review-gate.DEV2.AC2.phase_review_runs_fresh

Given a phase exit triggers the independent review
When the review runs
Then it runs as a fresh reviewer (isolation, no conversation history) and its verdict becomes the recorded stamp

- [ ] RED skip: agent behavior — live-verified
- [ ] GREEN skip: agent behavior
- [ ] REFACTOR skip: agent behavior

## Rule: Coverage gate fires on genuine gaps, silent otherwise **[hook]**

### Scenario: review-gate.SM1.AC1.uncovered_ac_blocks

Given a test-definitions.md with an acceptance criterion no scenario covers
When it is created
Then the write is denied, naming the uncovered AC

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: review-gate.SM1.AC1.orphan_scenario_blocks

Given a scenario whose name carries no `<jtbd>.AC<n>` lineage to any AC
When the test-definitions is created
Then the write is denied, naming the orphan scenario

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: review-gate.SM1.AC1.complete_coverage_silent

Given every AC is covered and there are no orphan scenarios
When the test-definitions is created
Then it passes with no prompt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Every new gate has a logged one-step skip **[hook]**

### Scenario: review-gate.SM1.AC2.skip_clears_and_logs

Given any of the new gates would deny
When the agent supplies `skip: <non-empty reason>`
Then the gate clears and the reason is recorded in the ledger

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Invariants

- `templates/hooks/` and `.safeword/hooks/` are byte-identical (`diff -q`) after all changes.
