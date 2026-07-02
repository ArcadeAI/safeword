# Test Definitions: Cloud retro filing — try-REST-then-agent-subagent transport

Feature source: `packages/cli/features/cloud-retro-filing-transport.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Transport selection files locally and defers in cloud

### Scenario: A valid token files directly via REST and surfaces nothing

- [x] RED 0beb652
- [x] GREEN 0beb652 — all filed + spool drained + agentFilingNeeded false
- [x] REFACTOR 9f6a485 — "surfaces nothing" proven: silent-when-empty-spool integration test

### Scenario: A REST failure leaves the drafts spooled for the agent path

- [x] RED 0beb652
- [x] GREEN 0beb652 — REST 401 → all drafts retained + agentFilingNeeded true
- [x] REFACTOR 0beb652

### Scenario: A partial REST result marks only the drafts REST actually filed

- [x] RED 0beb652
- [x] GREEN 0beb652 — fresh spool re-read yields only the rejected draft
- [x] REFACTOR 0beb652

## Rule: Findings from a cloud session reach the tracker

### Scenario: The filing subagent posts each spooled draft body verbatim

- [x] RED 8b21bd3
- [x] GREEN 8b21bd3 — exactly-2 posts, each body byte-equal incl signature marker, spool drained
- [x] REFACTOR 8b21bd3

### Scenario: A draft the subagent could not post stays spooled for the next boundary

- [x] RED 8b21bd3
- [x] GREEN 8b21bd3 — un-posted draft retained; later boundary nudges for the remaining
- [x] REFACTOR 8b21bd3

## Rule: No duplicates across the fallback

### Scenario: Marking a draft filed drains it from the persisted spool

- [x] RED 57db830
- [x] GREEN 57db830
- [x] REFACTOR 57db830

Unit also covers the partial-drain path (drains only the filed subset), which the
REST-partial and subagent-partial wiring scenarios consume.

### Scenario: A boundary with no unfiled drafts neither re-nudges nor re-files

- [x] RED ffeb3b1
- [x] GREEN ffeb3b1 — empty spool → fileSpooledDrafts posts 0 + decideRetroNudge undefined
- [x] REFACTOR ffeb3b1

## Rule: The cloud fallback stays near-invisible

### Scenario: Extraction and spooling add nothing to the conversation

- [ ] RED skip: composition of two already-green properties, no new failing test
- [ ] GREEN skip: async Stop hook emits no stdout/additionalContext (tests/integration/stop-retro.test.ts) AND the retro spools on that async path (tests/commands/retro.test.ts transport-selection)
- [ ] REFACTOR skip: no dedicated test — the async:true config makes the hook surface nothing by construction (ZFGWS1)

### Scenario: Unfiled drafts at a boundary surface exactly one factual line

- [x] RED 5413bbf
- [x] GREEN 5413bbf
- [x] REFACTOR 9f6a485

### Scenario: No unfiled drafts means the boundary stays silent

- [x] RED 5413bbf
- [x] GREEN 5413bbf
- [x] REFACTOR 9f6a485

### Scenario: The fallback line is a statement, not an imperative

- [x] RED 5413bbf
- [x] GREEN 5413bbf
- [x] REFACTOR 9f6a485

### Scenario: The fallback nudges once per unfiled batch

- [x] RED 5413bbf
- [x] GREEN 5413bbf
- [x] REFACTOR 9f6a485

### Scenario: A batch that gains a new unfiled draft nudges again

- [x] RED 5413bbf
- [x] GREEN 5413bbf
- [x] REFACTOR 9f6a485

## Rule: No leak on disk

### Scenario: Only post-egress draft fields reach the spool

- [x] RED ffeb3b1
- [x] GREEN ffeb3b1 — real egress → spool file carries neither secret nor path, only the 4 fields
- [x] REFACTOR ffeb3b1
