# Test Definitions: Architecture state docs — Slice 1

Feature source: `features/architecture-state-docs.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature` source; this file tracks per-scenario RED → GREEN → REFACTOR progress.

## Rule: The skeleton reflects the real project

### Scenario: The listed modules equal the real tree, with resolving references

- [x] RED 70fb2d2
- [x] GREEN f73c7d5
- [ ] REFACTOR skip: minimal enumeration, no structural improvement needed

### Scenario: Every skeleton node carries a non-empty purpose

- [x] RED e55e9fd
- [x] GREEN 1cce7a9
- [ ] REFACTOR skip: simple filter + constant, no structural improvement needed

### Scenario: A file outside any module is not listed as a node

- [x] RED skip: already satisfied by the extractor's src-only scan; added as a regression guard
- [x] GREEN a939add
- [ ] REFACTOR skip: guard test, no production change

### Scenario: A project with no src directory still produces a doc

- [x] RED skip: already satisfied by the extractor's read-error fallback; added as a regression guard
- [x] GREEN a939add
- [ ] REFACTOR skip: guard test, no production change

### Scenario: A src directory with zero modules produces an empty skeleton

- [x] RED skip: already satisfied by the extractor's directory filter; added as a regression guard
- [x] GREEN a939add
- [ ] REFACTOR skip: guard test, no production change

### Scenario: Extraction is content-agnostic — a malformed file never aborts it

- [x] RED skip: structure-based extractor never reads source bytes, so it is robust by design; added as a guard
- [x] GREEN 3a28686
- [ ] REFACTOR skip: guard test, no production change beyond dropping the unused skipped field

## Rule: Stale prose is visibly flagged, never silently wrong

### Scenario: Prose reconciled with the current structure shows no marker

- [x] RED aa1a84c
- [x] GREEN c92933e
- [ ] REFACTOR skip: simple verdict mapping, no structural improvement needed

### Scenario: Prose that has fallen behind the structure is marked stale

- [x] RED aa1a84c
- [x] GREEN c92933e
- [ ] REFACTOR skip: simple verdict mapping, no structural improvement needed

### Scenario: A section describing a removed node is flagged orphaned, not merely stale

- [x] RED aa1a84c
- [x] GREEN c92933e
- [ ] REFACTOR skip: simple verdict mapping, no structural improvement needed

### Scenario: A newly added node gets a purpose placeholder and is not marked stale

- [x] RED aa1a84c
- [x] GREEN c92933e
- [ ] REFACTOR skip: simple verdict mapping, no structural improvement needed

## Rule: Structural facts self-heal at session start

### Scenario: A moved fingerprint heals the doc to the current shape

- [x] RED e033412
- [x] GREEN 44dd511
- [ ] REFACTOR skip: composed from already-tested units, no structural improvement needed

### Scenario: An unchanged fingerprint leaves the doc untouched

- [x] RED e033412
- [x] GREEN 44dd511
- [ ] REFACTOR skip: composed from already-tested units, no structural improvement needed

### Scenario: A project with no architecture doc gets one created

- [x] RED e033412
- [x] GREEN 44dd511
- [ ] REFACTOR skip: composed from already-tested units, no structural improvement needed

### Scenario: A doc with a missing or corrupt fingerprint is regenerated, never left unreconciled

- [x] RED e033412
- [x] GREEN 44dd511
- [ ] REFACTOR skip: composed from already-tested units, no structural improvement needed

## Rule: The fingerprint captures shape, not noise

### Scenario Outline: The fingerprint changes only for structural change

- [x] RED 769c058
- [x] GREEN acdc2b7
- [ ] REFACTOR skip: extracted scan helper during GREEN to satisfy complexity lint; no further structural improvement

### Scenario: An out-of-band change is healed and its lagging prose flagged at session start

- [x] RED 2e8995d
- [x] GREEN 669ba55
- [ ] REFACTOR skip: per-section stamp rendering already factored into helpers
