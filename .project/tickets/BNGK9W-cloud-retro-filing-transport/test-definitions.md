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

### Scenario: A partial REST result marks only the drafts REST actually filed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Findings from a cloud session reach the tracker

### Scenario: The filing subagent posts each spooled draft body verbatim

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A draft the subagent could not post stays spooled for the next boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: No duplicates across the fallback

### Scenario: Marking a draft filed drains it from the persisted spool

- [x] RED 57db830
- [x] GREEN 57db830
- [x] REFACTOR 57db830

Unit also covers the partial-drain path (drains only the filed subset), which the
REST-partial and subagent-partial wiring scenarios consume.

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

- [x] RED 5413bbf
- [x] GREEN 5413bbf
- [ ] REFACTOR skip: hook wiring drives it end-to-end in slice 5

### Scenario: No unfiled drafts means the boundary stays silent

- [x] RED 5413bbf
- [x] GREEN 5413bbf
- [ ] REFACTOR skip: hook wiring drives it end-to-end in slice 5

### Scenario: The fallback line is a statement, not an imperative

- [x] RED 5413bbf
- [x] GREEN 5413bbf
- [ ] REFACTOR skip: hook wiring drives it end-to-end in slice 5

### Scenario: The fallback nudges once per unfiled batch

- [x] RED 5413bbf
- [x] GREEN 5413bbf
- [ ] REFACTOR skip: hook wiring drives it end-to-end in slice 5

### Scenario: A batch that gains a new unfiled draft nudges again

- [x] RED 5413bbf
- [x] GREEN 5413bbf
- [ ] REFACTOR skip: hook wiring drives it end-to-end in slice 5

## Rule: No leak on disk

### Scenario: Only post-egress draft fields reach the spool

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
