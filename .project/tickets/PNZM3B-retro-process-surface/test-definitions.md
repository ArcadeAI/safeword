# Test Definitions: Retro process-level surfaces and egress-drop reporting

Feature source: `packages/cli/features/retro-process-surface.feature`

test-definitions.md is the R/G/R ledger.

Quality-review notes for implement (2026-07-07): run the hex/secret-shape
rejection on slugs of ANY length (no ≥20-char floor) and on hyphen-split
segments; assert the rendered summary line with counts flowing from
prepareEncounters through the command reporter, never a hand-injected counts
object.

## Rule: retro-process-surface.SM1.R1 — A process-area finding survives egress and files like any file-surfaced finding

### Scenario: A finding surfaced as a valid process area becomes a filable encounter

- [x] RED 91548ee
- [x] GREEN 9e1cc9a
- [x] REFACTOR skip: minimal additive branch, extraction helper already in place for the strictness loops

### Scenario: A process-surfaced finding files end to end through the retro run

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A process-surfaced draft carries the process label

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A file-surfaced draft is unchanged by the process namespace

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A non-safeword file path is still dropped

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: retro-process-surface.SM1.R2 — The process namespace stays fail-closed against non-slug and secret-shaped values

### Scenario: A process surface outside the strict slug shape is dropped

- [x] RED 30fdf25
- [x] GREEN 9951350
- [x] REFACTOR skip: wall helpers named and documented at authoring; no duplication introduced

### Scenario: An ordinary word slug at the length boundary survives

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A slug with a hex-alphabet dictionary word among non-hex segments survives

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: retro-process-surface.SM1.R3 — Extraction guidance offers the process surface instead of fabricated file paths

### Scenario: The shared extraction prompt offers the process namespace

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The Codex schema's surface description names the same process form

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A surface is still required of every finding

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: retro-process-surface.SM2.R1 — The run summary reports drops per egress wall and stays quiet when clean

### Scenario: Unresolvable-surface drops are counted in the summary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Off-schema drops are counted in the summary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Drops at both walls in one run are reported separately

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A clean run's summary carries no drop line

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
