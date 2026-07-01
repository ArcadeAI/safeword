# Test Definitions: Cloud retro filing — try-REST-then-agent-subagent transport

Feature source: `packages/cli/features/cloud-retro-filing-transport.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Transport selection files locally and defers in cloud

### Scenario: A valid token files directly via REST and surfaces nothing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A REST failure leaves the drafts spooled for the agent path

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Findings from a cloud session reach the tracker

### Scenario: The filing subagent posts each spooled draft body verbatim

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: No duplicates across the fallback

### Scenario: A filed draft is drained from the spool

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A boundary with no unfiled drafts neither re-nudges nor re-files

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The cloud fallback stays near-invisible

### Scenario: Extraction and spooling add nothing to the conversation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unfiled drafts at a boundary surface exactly one factual line

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No unfiled drafts means the boundary stays silent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The fallback line is a statement, not an imperative

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The fallback nudges once per unfiled batch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: No leak on disk

### Scenario: Only post-egress draft fields reach the spool

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
